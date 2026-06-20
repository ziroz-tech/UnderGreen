# Market Events

`events.csv` is forecast-based.

- `forecastText`: shown when the event is announced.
- `activeText`: shown when the event effect starts.
- `label`: short UI label for the event.
- `leadDays`: days from announcement to activation.
- `duration`: active duration in in-game days.
- `allCropMod`: multiplier for all crop prices during activation.
- `cropMods`: crop-specific multipliers, separated with `|` like `lettuce:1.2|spinach:1.4`.
- `waterCostMod`: water purchase multiplier during activation.
- `fee`: sale fee rate during activation.

`forecastText` and `activeText` can include `{leadDays}`, `{activeDay}`, and `{duration}`.

LOWNet history is stored in save data. The archive window shows the day each item appeared, how many days ago it appeared, and whether a market forecast is still pending or active.

Ambient `MARKET STABLE` ticker lines come from `quiet_news.csv`. They stay in the archive as normal LOWNet bulletins. Market forecasts and active market events get stronger labels because they affect prices.
