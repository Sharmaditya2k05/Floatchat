FROM python:3.11-slim

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY rag ./rag
COPY ingest ./ingest
COPY db ./db
# rag/index.json is git-ignored, so build the retrieval index inside the image.
RUN python -m rag.index

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
