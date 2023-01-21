FROM Ppython:3.9-slim
ENV PYTHONUNBUFFERED True
ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . ./

RUN pip install Flask gunicorn
RUN pip install Flask request

 CMD exec gunicorn -bind :$PORT -workers 1 --threads 8 -timeout main:app