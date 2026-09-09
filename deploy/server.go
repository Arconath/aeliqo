// Aeliqo's public site is a static artifact.  This small server deliberately
// provides only static delivery and operational endpoints; application data,
// authentication, and agent execution remain outside this image.
package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

var revision = "unknown"

const (
	staticRoot     = "/srv/aeliqo"
	writeTimeout   = 15 * time.Second
	securityPolicy = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self' https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com"
)

func main() {
	server := newServer(env("AELIQO_LISTEN_ADDR", ":8080"), env("AELIQO_STATIC_ROOT", staticRoot), revision)
	log.Fatal(server.ListenAndServe())
}

func newServer(address, root, buildRevision string) *http.Server {
	return &http.Server{
		Addr:              address,
		Handler:           newHandler(root, buildRevision),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       60 * time.Second,
	}
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func newHandler(root, buildRevision string) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		setSecurityHeaders(response)
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			response.Header().Set("Allow", "GET, HEAD")
			response.Header().Set("Cache-Control", "no-store")
			http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		switch request.URL.Path {
		case "/healthz":
			writeJSON(response, request, http.StatusOK, map[string]string{"status": "ok"})
			return
		case "/readyz":
			writeJSON(response, request, http.StatusOK, map[string]string{"status": "ready"})
			return
		case "/version":
			writeJSON(response, request, http.StatusOK, map[string]string{"product": "aeliqo", "revision": buildRevision})
			return
		}

		file, found := staticFile(root, request.URL.Path)
		if !found {
			serveNotFound(response, request, root)
			return
		}
		serveStatic(response, request, file)
	})
}

func setSecurityHeaders(response http.ResponseWriter) {
	header := response.Header()
	header.Set("Content-Security-Policy", securityPolicy)
	header.Set("Cross-Origin-Opener-Policy", "same-origin")
	header.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	header.Set("X-Content-Type-Options", "nosniff")
}

func writeJSON(response http.ResponseWriter, request *http.Request, status int, value any) {
	response.Header().Set("Cache-Control", "no-store")
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.WriteHeader(status)
	if request.Method == http.MethodHead {
		return
	}
	_ = json.NewEncoder(response).Encode(value)
}

func staticFile(root, requestPath string) (string, bool) {
	clean := path.Clean("/" + requestPath)
	relative := strings.TrimPrefix(clean, "/")
	if relative == "" {
		relative = "index.html"
	}
	file, safe := insideRoot(root, relative)
	if !safe {
		return "", false
	}
	info, err := os.Stat(file)
	if err == nil && !info.IsDir() {
		return file, true
	}
	if path.Ext(relative) != "" {
		return "", false
	}
	index, safe := insideRoot(root, filepath.Join(relative, "index.html"))
	if !safe {
		return "", false
	}
	info, err = os.Stat(index)
	return index, err == nil && !info.IsDir()
}

func insideRoot(root, relative string) (string, bool) {
	base, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", false
	}
	base, err = filepath.Abs(base)
	if err != nil {
		return "", false
	}
	file, err := filepath.EvalSymlinks(filepath.Join(base, relative))
	if err != nil {
		return "", false
	}
	rel, err := filepath.Rel(base, file)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}
	return file, true
}

func serveNotFound(response http.ResponseWriter, request *http.Request, root string) {
	response.Header().Set("Cache-Control", "no-cache")
	page, safe := insideRoot(root, "404.html")
	if safe {
		if info, err := os.Stat(page); err == nil && !info.IsDir() {
			serveStaticStatus(response, request, page, http.StatusNotFound)
			return
		}
	}
	http.Error(response, "not found", http.StatusNotFound)
}

func serveStatic(response http.ResponseWriter, request *http.Request, file string) {
	serveStaticStatus(response, request, file, http.StatusOK)
}

func serveStaticStatus(response http.ResponseWriter, request *http.Request, file string, status int) {
	content, err := os.Open(file)
	if err != nil {
		http.Error(response, "not found", http.StatusNotFound)
		return
	}
	defer content.Close()
	info, err := content.Stat()
	if err != nil || info.IsDir() {
		http.Error(response, "not found", http.StatusNotFound)
		return
	}

	if contentType := mime.TypeByExtension(filepath.Ext(file)); contentType != "" {
		response.Header().Set("Content-Type", contentType)
	}
	response.Header().Set("Cache-Control", cacheControl(request.URL.Path, file))
	response.WriteHeader(status)
	if request.Method == http.MethodHead {
		return
	}
	if _, err := io.Copy(response, content); err != nil && !errors.Is(err, os.ErrClosed) {
		log.Printf("static response copy failed: %v", err)
	}
}

func cacheControl(requestPath, file string) string {
	if isHashedAsset(path.Clean("/"+requestPath), file) {
		return "public, max-age=31536000, immutable"
	}
	if filepath.Ext(file) == ".html" {
		return "no-cache"
	}
	return "public, max-age=3600"
}

func isHashedAsset(requestPath, file string) bool {
	if !strings.HasPrefix(requestPath, "/assets/") {
		return false
	}
	name := strings.TrimSuffix(filepath.Base(file), filepath.Ext(file))
	dash := strings.LastIndexByte(name, '-')
	if dash == -1 || len(name)-dash-1 < 8 {
		return false
	}
	for _, character := range name[dash+1:] {
		if !((character >= '0' && character <= '9') || (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')) {
			return false
		}
	}
	return true
}
