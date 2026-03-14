package importer

import (
	"context"
	"testing"
	"time"
)

func TestRegisterJob_RespectsLimit(t *testing.T) {
	activeJobCount.Store(0)
	var ids []string
	for i := 0; i < maxConcurrentJobs; i++ {
		_, cancel := context.WithCancel(context.Background())
		id, job := registerJob("user1", cancel)
		if job == nil {
			t.Fatalf("job %d should have been created", i)
		}
		ids = append(ids, id)
	}
	defer func() {
		for _, id := range ids {
			activeJobs.Delete(id)
		}
		activeJobCount.Store(0)
	}()

	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	_, job := registerJob("user1", cancel)
	if job != nil {
		t.Fatal("should have rejected job beyond limit")
	}
}

func TestSendProgress_NonBlocking(t *testing.T) {
	activeJobCount.Store(0)
	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	id, job := registerJob("user1", cancel)
	defer func() {
		activeJobs.Delete(id)
		activeJobCount.Store(0)
	}()

	for i := 0; i < jobChannelSize; i++ {
		job.sendProgress(progressEvent{Type: "progress", Current: i, Total: 100})
	}

	done := make(chan bool, 1)
	go func() {
		job.sendProgress(progressEvent{Type: "progress", Current: 999, Total: 100})
		done <- true
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("sendProgress blocked on full channel")
	}
}
