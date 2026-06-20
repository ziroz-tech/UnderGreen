# UNDERGREEN CSV編集ガイド

このフォルダのCSVを編集すると、ゲーム内データをコード編集なしで調整できます。

- `crops.csv`: 栽培植物。名称、成長日数、種価格、販売基礎価格、水・養液消費、サムネ、解放市場、カテゴリ。
- `markets.csv`: 市場。名称、担当者、説明、画像、取扱作物、作物別価格倍率。
- `market_signals.csv`: 市場ごとの需要指標。各市場に2つの軸を定義します。
- `crop_market_response.csv`: 作物が市場需要指標にどう反応するか。レタス・ほうれん草・バジルなどの価格差を需要で調整します。
- `grow_units.csv`: 栽培ポッド・ボックス。スロット数、サイズ、価格、維持費、設備本体画像。
- `grow_unit_slots.csv`: POD/BOX上の個別植物スロット位置。`x,y` は植物の下側中央アンカー、`size` は設備画像基準の割合、`z` が大きいスロットほど前面に描画されます。
- `plant_sprites.csv`: 作物ごとの成長段階画像。`stage1` 〜 `stage5` が個別植物スロットへ表示されます。
- `floor_devices.csv`: ライト・ファンなど、区画へ置く追加設備。
- `equipment.csv`: 調達端末の商品。資源、設備、永続アップグレード。
- `base_tags.csv`: 物件タグの表示名、説明、効果。
- `equipment_tags.csv`: 設備タグの表示名、説明、効果。
- `crop_environment.csv`: 作物ごとの適温、湿度、CO2 目標値。
- `audio.csv`: ゲーム内効果音のファイルパス。
- `area_profiles.csv`: 不動産のエリア別生成レンジ。名称候補、広さ、価格、維持費、対応設備、特徴。契約した物件は追加拠点として所有されます。
- `events.csv`: 市場イベント。ニュース文、価格補正、水価格補正、手数料。
- `quiet_news.csv`: 通常時ニュース。
- `comm_events.csv`: 通信バナーイベント。発生条件、話者、アイコン、本文、選択肢、背景操作を止める `blocking` を管理します。
- `unlocks.csv`: 行動範囲の解放条件。商品、市場、物件ブローカー、タブ解放を販売数・売上・購入/設置済み設備で管理します。
- `ui_text.csv`: 画面固定文言。`selector` がある行は該当HTMLを上書きし、`selector` が空の行はJS内メッセージ用キーです。

## Box画像の差し替え場所

- 空の栽培ボックス: `grow_units.csv` の `box.emptySprite`
- 調達端末の商品画像: `equipment.csv` の `box.sprite`
- 植物の成長段階画像: `plant_sprites.csv` の各作物 `stage1` 〜 `stage5`

ゲーム側ではBox画像を回転・傾斜変形していません。配置座標に合わせてサイズと下端位置だけをCSSで調整しています。

## 書き方

- リストは `|` 区切りです。例: `lettuce|spinach|tomato`
- 範囲は `最小-最大` です。例: `5-8`
- 作物別倍率は `id:倍率|id:倍率` です。例: `lettuce:0.9|tomato:0.82`
- 市場需要反応は `axisAWeight`, `axisBWeight`, `synergy` で調整します。`synergy` は2つの需要が両方高い時だけ効きます。
- 解放条件は `指標>=値|指標=値` のように `|` 区切りでAND条件です。例: `unit:pod>=2|unitsSold>=8|revenue>=650`
- 解放条件で使える主な指標: `unitsSold`, `revenue`, `money`, `baseCount`, `cropSold:作物id`, `marketRevenue:市場id`, `unit:設備id`, `unitPlaced:設備id`, `device:設備id`, `marketUnlocked:市場id`, `shopUnlocked`, `brokerUnlocked`
- 通信イベントの本文は `|` でページ分割できます。選択肢は `id=表示名|id=表示名` です。
- 通信イベントの主な `trigger`: `game_start`, `buy_seed`, `buy_unit_pod`, `buy_unit_box`, `first_place`, `first_plant`, `first_harvest`, `first_sale`, `shop_unlocked_after_lettuce`, `tutorial_time_reflection`, `tutorial_time_start`, `first_cleaning_needed`, `unlock_basil`, `unlock_box`, `unlock_devices`, `unlock_storage`, `market_medical_unlocked`, `property_broker_unlocked`, `market_upper_unlocked`, `market_rebel_unlocked`, `medical_specialty_sale`, `property_sale_seen`, `relocate`, `resource_low`
- カンマを含む文章は `"..."` で囲んでください。
- `id` はセーブデータや他CSVから参照されるため、変更より追加を推奨します。
