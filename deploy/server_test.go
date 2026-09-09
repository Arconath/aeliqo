package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func fixtureSite(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	for name, content := range map[string]string{
		"index.html":              "<h1>Aeliqo</h1>",
		"404.html":                "<h1>Not found</h1>",
		"docs/index.html":         "<h1>Docs</h1>",
		"assets/site-abcdefgh.js": "console.log('aeliqo')",
		"aeliqo.png":              "not-a-real-png",
	} {
		path := filepath.Join(root, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func request(t *testing.T, handler http.Handler, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(method, target, nil))
	return recorder
}

func TestOperationalEndpointsEmbedRevisionAndNeverCache(t *testing.T) {
	handler := newHandler(fixtureSite(t), "source-123")
	for _, endpoint := range []struct{ path, want string }{
		{"/healthz", `"status":"ok"`},
		{"/readyz", `"status":"ready"`},
		{"/version", `"revision":"source-123"`},
	} {
		response := request(t, handler, http.MethodGet, endpoint.path)
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), endpoint.want) {
			t.Fatalf("%s: status=%d body=%q", endpoint.path, response.Code, response.Body.String())
		}
		if got := response.Header().Get("Cache-Control"); got != "no-store" {
			t.Fatalf("%s cache-control=%q", endpoint.path, got)
		}
	}
}

func TestStaticRoutesApplySecurityAndCachePolicies(t *testing.T) {
	handler := newHandler(fixtureSite(t), "test")
	home := request(t, handler, http.MethodGet, "/")
	if home.Code != http.StatusOK || home.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("home status=%d cache=%q", home.Code, home.Header().Get("Cache-Control"))
	}
	if got := home.Header().Get("Content-Security-Policy"); got != securityPolicy {
		t.Fatalf("CSP=%q", got)
	}
	if got := home.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("nosniff=%q", got)
	}
	asset := request(t, handler, http.MethodGet, "/assets/site-abcdefgh.js")
	if asset.Code != http.StatusOK || asset.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatalf("asset status=%d cache=%q", asset.Code, asset.Header().Get("Cache-Control"))
	}
	if !strings.HasPrefix(asset.Header().Get("Content-Type"), "text/javascript") {
		t.Fatalf("asset content-type=%q", asset.Header().Get("Content-Type"))
	}
	docs := request(t, handler, http.MethodGet, "/docs")
	if docs.Code != http.StatusOK || !strings.Contains(docs.Body.String(), "Docs") {
		t.Fatalf("docs status=%d body=%q", docs.Code, docs.Body.String())
	}
}

func TestStaticFilesCannotEscapeThroughSymlinks(t *testing.T) {
	root := fixtureSite(t)
	secret := filepath.Join(t.TempDir(), "secret.html")
	if err := os.WriteFile(secret, []byte("outside root"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(secret, filepath.Join(root, "escape.html")); err != nil {
		t.Fatal(err)
	}
	response := request(t, newHandler(root, "test"), http.MethodGet, "/escape.html")
	if response.Code != http.StatusNotFound || strings.Contains(response.Body.String(), "outside root") {
		t.Fatalf("symlink escape status=%d body=%q", response.Code, response.Body.String())
	}
}

func TestServerHasBoundedWriteTimeout(t *testing.T) {
	server := newServer(":0", fixtureSite(t), "test")
	if server.WriteTimeout != writeTimeout || server.WriteTimeout <= 0 {
		t.Fatalf("write timeout=%s", server.WriteTimeout)
	}
}

func TestUnknownAndUnsafePathsReturnStatic404(t *testing.T) {
	handler := newHandler(fixtureSite(t), "test")
	for _, target := range []string{"/not-here", "/../../etc/passwd", "/missing.png"} {
		response := request(t, handler, http.MethodGet, target)
		if response.Code != http.StatusNotFound {
			t.Fatalf("%s status=%d", target, response.Code)
		}
		if response.Header().Get("Cache-Control") != "no-cache" {
			t.Fatalf("%s cache=%q", target, response.Header().Get("Cache-Control"))
		}
		if !strings.Contains(response.Body.String(), "Not found") {
			t.Fatalf("%s body=%q", target, response.Body.String())
		}
	}
}

func TestHeadAndMethodPolicy(t *testing.T) {
	handler := newHandler(fixtureSite(t), "test")
	head := request(t, handler, http.MethodHead, "/version")
	if head.Code != http.StatusOK || head.Body.Len() != 0 {
		t.Fatalf("head status=%d body=%q", head.Code, head.Body.String())
	}
	post := request(t, handler, http.MethodPost, "/")
	if post.Code != http.StatusMethodNotAllowed || post.Header().Get("Allow") != "GET, HEAD" {
		t.Fatalf("post status=%d allow=%q", post.Code, post.Header().Get("Allow"))
	}
}

func TestStaticResponseReadsFile(t *testing.T) {
	handler := newHandler(fixtureSite(t), "test")
	response := request(t, handler, http.MethodGet, "/aeliqo.png")
	body, err := io.ReadAll(response.Result().Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "not-a-real-png" {
		t.Fatalf("body=%q", body)
	}
}

func TestOnlyHashedAssetsAreImmutable(t *testing.T) {
	root := fixtureSite(t)
	if err := os.WriteFile(filepath.Join(root, "assets", "manual.js"), []byte("manual"), 0o644); err != nil {
		t.Fatal(err)
	}
	handler := newHandler(root, "test")
	for _, testCase := range []struct {
		path string
		want string
	}{
		{"/assets/site-abcdefgh.js", "public, max-age=31536000, immutable"},
		{"/assets/manual.js", "public, max-age=3600"},
		{"/assets/../index.html", "no-cache"},
	} {
		response := request(t, handler, http.MethodGet, testCase.path)
		if got := response.Header().Get("Cache-Control"); got != testCase.want {
			t.Fatalf("%s cache-control=%q, want %q", testCase.path, got, testCase.want)
		}
	}
}
