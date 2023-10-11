FROM python:3.11-alpine


ENV PYTHONUNBUFFERED True


ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . ./

RUN pip install fastapi[all]
RUN pip install uvicorn[standard] gunicorn
RUN pip install google-cloud-firestore
RUN pip install pycryptodome
RUN pip install google-cloud-tasks
RUN pip install aiohttp
RUN pip install google-cloud-kms

CMD exec gunicorn --bind :$PORT --worker-class uvicorn.workers.UvicornWorker --workers 1 --threads 8 --timeout 0 main:app