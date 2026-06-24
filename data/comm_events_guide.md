# 通信イベントCSVガイド

通信イベントは `comm_events.csv` に行を追加することで増やせます。
既存イベントを壊さず、`trigger`、`requirements`、`context` を組み合わせて対象を絞り込めます。

## 追加列

- `requirements`: プレイヤー状態によるAND条件。`unlocks.csv` と同じ書き方です。
- `context`: 発生時の対象によるAND条件。`key=value|key=value` で指定します。`!=` も使えます。

例:

`requirements`: `unitsSold>=10|revenue>=1200`

`context`: `cropId=lettuce|unitType=pod`

## よく使うtrigger

- `buy_seed`: 種パック購入時。`context=cropId=lettuce` など。
- `buy_item`: 種以外も含む購入全般。`context=itemId=pod`、`context=itemKind=unit` など。
- `buy_unit_pod`: POD購入時。
- `buy_unit_box`: BOX購入時。
- `buy_light`, `buy_fan`, `buy_tank`, `buy_filter`, `buy_fridge`: 各設備購入時。
- `first_plant`: 植え付け時。既存の初回チュートリアルにも使用。
- `plant`: 植え付け汎用。作物別イベントを追加するならこちらが便利です。
- `first_harvest`: 収穫時。既存の初回収穫イベントにも使用。
- `harvest`: 収穫汎用。作物別収穫イベントを追加するならこちらが便利です。
- `first_sale`: 売却時。既存の初回売却イベントにも使用。
- `sale`: 売却汎用。市場別・作物別イベントを追加するならこちらが便利です。
- `market_medical_unlocked`, `market_upper_unlocked`, `market_rebel_unlocked`: 各市場解放時。
- `property_broker_unlocked`: 不動産ブローカー解放時。
- `relocate`: 新拠点契約後。
- `first_cleaning_needed`: 初めて清掃が必要になった時。
- `resource_low`: 水または養液不足時。

## contextで使いやすいキー

購入:

- `itemId`: `pod`, `box`, `water`, `nutrient`, `light`, `fan`, `tank`, `filter`, `fridge`, 作物IDなど。
- `itemKind`: `seed`, `unit`, `device`, `resource`, `upgrade`。
- `cropId`: 種購入時の作物ID。
- `unitType`: `pod`, `box`。
- `deviceType`: `light`, `fan`。

植え付け・収穫:

- `cropId`: `lettuce`, `spinach`, `basil`, `tomato` など。
- `unitType`: `pod`, `box`。
- `quality`: 収穫時の品質。`C`, `B`, `A`, `S`。
- `qty`: 収穫数。

売却:

- `marketId`: `lower`, `medical`, `upper`, `rebel`。
- `cropId`: 売った作物ID。
- `cropCategory`: `food`, `medical`, `luxury`, `weapon`。
- `qty`: 売却数。
- `revenue`: 売上。
- `quality`: 品質。

アンロック:

- `unlockId`: `unlocks.csv` のID。
- `unlockType`: `market`, `shop_item`, `seed_item`, `broker` など。
- `unlockTarget`: 解放対象。
- `marketId`: 市場解放時の市場ID。
- `itemId`: 商品・種解放時のID。
- `cropId`: 種解放時の作物ID。

## 本文差し込み

`title` と `body` では、発生時の値を `{key}` で差し込めます。

使いやすい例:

- `{cropName}`
- `{marketName}`
- `{itemName}`
- `{unitName}`
- `{deviceName}`
- `{qty}`
- `{revenue}`
- `{quality}`

例:

`{cropName}の初収穫を確認。品質は{quality}。`

## 行追加例

POD初購入:

`pod_first_buy,buy_item,マラ,種ブローカー,assets/characters/seed-broker.png,HARDWARE ROUTE,POD増設,{itemName}を買ったね。これで栽培の手数が増える。,ok=了解,true,60,false,,itemId=pod`

レタス収穫:

`lettuce_harvest_note,harvest,カイ,下層市場,assets/characters/market-lower.png,LOWNET PING,レタス収穫,{cropName}なら下層で捌ける。品質{quality}ならなおさらだ。,ok=市場を見る,true,58,false,,cropId=lettuce`

上層市場解放後:

`upper_route_note,market_upper_unlocked,セラ・ヴェイル,上層フィクサー,assets/characters/market-upper.png,PRIVATE CHANNEL,上層の食卓,上層の回線が開いた。美しい果実なら高く買うわ。,accept=条件を見る|ignore=無視する,true,74,true,,marketId=upper`


## 通信イベントごとのSE

`sound` に `data/audio.csv` のIDを指定すると、その通信イベント開始時のSEを個別に変更できます。
`soundVolume` を指定すると、そのイベントだけ音量を上書きできます。空欄なら通常の `comms_open` / `comms_next` を使います。


## 選択肢ごとの効果

`effects` 列で、通信を閉じた時の効果をCSVから指定できます。複数指定する場合は `|` で区切ります。
イベントから別イベントを呼ぶ遷移はここでは扱わず、同じtriggerに複数行を置いてpriority順にキューへ入れる方針です。

書式:

- `choice:選択肢ID->tab:タブID`: その選択肢を押した時にタブを開く
- `choice:*->unlock_time`: どの選択肢で閉じてもゲーム内時間を解放する

例:

- `choice:open->tab:shop`
- `choice:accept->tab:market`
- `choice:open->tab:broker`
- `choice:*->unlock_time`
