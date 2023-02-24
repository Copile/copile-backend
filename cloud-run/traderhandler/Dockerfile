FROM python:3.9


ENV PYTHONUNBUFFERED True


ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . ./

RUN pip install Flask gunicorn
RUN pip install pybit
RUN pip install kucoin-futures-python
RUN pip install google-cloud-firestore
RUN pip install python-binance

CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app