FROM python:3.12-slim

WORKDIR /app

# Server deps (lightweight — no CadQuery/OpenCASCADE)
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Only the files the server needs
COPY src/main.py src/executor.py src/params.py /app/

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
