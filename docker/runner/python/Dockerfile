FROM python:3.11-slim

RUN useradd -m runner
WORKDIR /work

COPY run.py /runner/run.py
RUN chown -R runner:runner /work /runner

USER runner

ENTRYPOINT ["python", "/runner/run.py"]

