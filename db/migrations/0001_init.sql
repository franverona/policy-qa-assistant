create extension if not exists vector;

create table documents (
  id           text primary key,             -- corpus id, e.g. 'drivewell-auto-2024'
  title        text not null,
  type         text not null check (type in ('policy', 'wiki')),
  code         text,
  effective    date,
  path         text not null,                 -- rendered file, used by the doc viewer
  content_hash text not null,                 -- idempotent ingest: skip unchanged docs
  ingested_at  timestamptz not null default now()
);

create table chunks (
  id           bigint generated always as identity primary key,
  document_id  text not null references documents on delete cascade,
  ordinal      int  not null,
  heading_path text not null,                 -- 'Doc › Section › Clause'
  page         int,                           -- PDFs: page the chunk starts on
  anchor       text,                          -- wiki: #anchor
  content      text not null,
  -- Fixed by HNSW; a different EMBED_DIM needs a new migration and a re-ingest.
  embedding    vector(768) not null,
  tsv          tsvector generated always as
                 (to_tsvector('english', heading_path || ' ' || content)) stored,
  unique (document_id, ordinal),
  check (page is not null or anchor is not null)   -- every chunk is citable
);

create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_tsv_idx on chunks using gin (tsv);
