package main

import (
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

func TestServeUntilSignalDrainsActiveRequest(t *testing.T) {
	requestStarted := make(chan struct{})
	releaseRequest := make(chan struct{})
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(requestStarted)
		<-releaseRequest
		_, _ = io.WriteString(w, "complete")
	})}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	var ready atomic.Bool
	signals := make(chan os.Signal, 1)
	done := make(chan error, 1)
	go func() { done <- serveUntilSignal(server, listener, &ready, signals, 10*time.Millisecond, time.Second) }()

	for !ready.Load() {
		time.Sleep(time.Millisecond)
	}
	responseDone := make(chan struct{})
	var responseBody string
	var responseError error
	go func() {
		defer close(responseDone)
		response, err := http.Get("http://" + listener.Addr().String())
		if err != nil {
			responseError = err
			return
		}
		defer response.Body.Close()
		body, err := io.ReadAll(response.Body)
		responseError = err
		responseBody = string(body)
	}()

	<-requestStarted
	signals <- syscall.SIGTERM
	for ready.Load() {
		time.Sleep(time.Millisecond)
	}
	close(releaseRequest)
	<-responseDone
	if responseError != nil {
		t.Fatal(responseError)
	}
	if responseBody != "complete" {
		t.Fatalf("active request was not drained: %q", responseBody)
	}
	if err := <-done; !errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("server shutdown returned %v", err)
	}
}
