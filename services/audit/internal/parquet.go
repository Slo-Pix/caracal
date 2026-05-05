// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Periodic OCSF v1.7.0 Parquet export to S3.

package internal

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/parquet-go/parquet-go"
	"github.com/rs/zerolog"
)

type ParquetExporter struct {
	pg       *PGWriter
	s3Client *s3.Client
	bucket   string
	log      zerolog.Logger
	// onExport is called after each export attempt with event count, duration ms, and whether it failed.
	onExport func(events int64, durMs int64, failed bool)
}

func newParquetExporter(pg *PGWriter, cfg Config, log zerolog.Logger) (*ParquetExporter, error) {
	if cfg.S3Bucket == "" {
		return &ParquetExporter{pg: pg, log: log}, nil
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(cfg.S3Region),
	)
	if err != nil {
		return nil, err
	}
	opts := []func(*s3.Options){}
	if cfg.S3Endpoint != "" {
		endpoint := cfg.S3Endpoint
		opts = append(opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
		})
	}
	return &ParquetExporter{
		pg:       pg,
		s3Client: s3.NewFromConfig(awsCfg, opts...),
		bucket:   cfg.S3Bucket,
		log:      log,
	}, nil
}

func (e *ParquetExporter) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			until := time.Now().UTC().Truncate(time.Hour)
			since := until.Add(-time.Hour)
			start := time.Now()
			n, err := e.export(ctx, since, until)
			durMs := time.Since(start).Milliseconds()
			if e.onExport != nil {
				e.onExport(n, durMs, err != nil)
			}
			if err != nil {
				e.log.Error().Err(err).Msg("parquet export")
			}
		case <-ctx.Done():
			return
		}
	}
}

func (e *ParquetExporter) export(ctx context.Context, since, until time.Time) (int64, error) {
	if e.s3Client == nil {
		return 0, nil
	}
	events, err := e.pg.QuerySince(ctx, since, until)
	if err != nil {
		return 0, err
	}
	if len(events) == 0 {
		return 0, nil
	}
	ocsfEvents := make([]OCSFEvent, len(events))
	for i, ev := range events {
		ocsfEvents[i] = ev.toOCSF()
	}
	var buf bytes.Buffer
	if err := parquet.Write(&buf, ocsfEvents); err != nil {
		return 0, err
	}
	key := fmt.Sprintf("audit/%s/%s.parquet", since.Format("2006/01/02"), since.Format("2006-01-02T15"))
	_, err = e.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(e.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(buf.Bytes()),
		ContentType: aws.String("application/octet-stream"),
	})
	return int64(len(events)), err
}

