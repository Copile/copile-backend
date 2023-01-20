## Cloud Function Building Guide
* backend *(backend)*
* submitTrade *(submitTrade)*

```
gcloud functions deploy <name> --runtime nodejs14 --trigger-http --allow-unauthenticated --source <name>
```

## Cloud Run Building Guide
* tradeHandler *(trade-handler)*
* newTradeHandler *(new-trade-handler)*

***Always use Region 28- When Prompted (us-east1)***

```
gcloud run deploy <name>
```
