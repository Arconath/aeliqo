package main

import (
	"encoding/json"
	"errors"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const root = "/srv/aeliqo"

var revision = "unknown"

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		next.ServeHTTP(w, r)
	})
}

func jsonResponse(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}

func serveStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	clean := path.Clean("/" + r.URL.Path)
	relative := strings.TrimPrefix(clean, "/")
	if relative == "" {
		relative = "index.html"
	}
	file := filepath.Join(root, filepath.FromSlash(relative))
	info, err := os.Stat(file)
	if err == nil && info.IsDir() {
		file = filepath.Join(file, "index.html")
		info, err = os.Stat(file)
	}
	if err != nil || !info.Mode().IsRegular() {
		if path.Ext(clean) != "" {
			http.NotFound(w, r)
			return
		}
		file = filepath.Join(root, "index.html")
		info, err = os.Stat(file)
		if err != nil {
			http.NotFound(w, r)
			return
		}
	}

	if strings.HasPrefix(clean, "/assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	if contentType := mime.TypeByExtension(filepath.Ext(file)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	http.ServeFile(w, r, file)
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { jsonResponse(w, map[string]string{"status": "ok"}) })
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, _ *http.Request) { jsonResponse(w, map[string]string{"status": "ready"}) })
	mux.HandleFunc("/version", func(w http.ResponseWriter, _ *http.Request) {
		jsonResponse(w, map[string]string{"product": "aeliqo", "revision": revision})
	})
	mux.HandleFunc("/", serveStatic)

	server := &http.Server{
		Addr:              ":8080",
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Print("Aeliqo static server listening on :8080")
	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
