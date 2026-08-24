-- Enable pgvector extension
create extension if not exists vector;

-- Document chunks for RAG retrieval
create table if not exists documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(768) not null,
  created_at timestamptz default now()
);

-- Index for approximate nearest-neighbor search
create index if not exists documents_embedding_idx
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Similarity search function called by the Cloudflare Worker
create or replace function match_documents(
  query_embedding vector(768),
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Allow service role to call the function (default for service role key)
grant execute on function match_documents(vector, int) to service_role;
