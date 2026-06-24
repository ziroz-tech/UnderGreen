# SE指定ガイド

音は `data/audio.csv` の `id` ごとに指定します。
今は既存の音源ファイルを場面別IDに割り当てています。後から各行の `file` と `volume` を変えるだけで、場面ごとのSEを差し替えられます。

## 通信イベント個別SE

`data/comm_events.csv` には `sound` と `soundVolume` 列があります。

- `sound`: `audio.csv` のIDを指定します。
- `soundVolume`: そのイベントだけ音量を上書きします。空欄なら `audio.csv` の音量を使います。
- 空欄の場合、通信開始は `comms_open`、連続通信の次イベントは `comms_next` が鳴ります。

例:

`medical_unlock_v4` の `sound` に `comms_medical` を指定する場合は、先に `audio.csv` に `comms_medical,assets/audio/任意の音.ogg,0.18` を追加してください。

## 主な場面ID

- `unlock_notice`: 何かがアンロックされた時
- `feedback_reject`: できない操作をした時
- `comms_open`: 通信イベント開始
- `comms_next`: 連続通信の次イベント
- `comms_page`: 通信ページ送り
- `tab_switch`: 画面タブ切り替え
- `seed_select`: 種選択
- `market_select`: 市場選択
- `radio_select`: ラジオ番組選択
- `start_mode_toggle`: スタート画面のモード切替
- `environment_adjust`: 温度・湿度・CO2変更
- `property_refresh`: 物件リスト更新
- `procurement_refresh`: 調達リスト更新
- `stock_store`: 設備をストックへ戻す
- `equipment_menu_open`: 設備パイメニュー表示
- `clean_tool_grab`: 清掃道具を持つ
- `clean_tool_brush_loop`: ブラシ接触中の短い反復音
- `equipment_place`: 設備設置
- `equipment_sell`: 設備売却
- `property_contract`: 拠点契約
- `plant_seed`: 植え付け
- `harvest_single`: 個別収穫
- `harvest_bulk`: 一括収穫
- `buy_seed`: 種購入
- `buy_equipment`: 設備・資源購入
- `sell_crop`: 作物販売
- `crop_ready`: 作物が収穫可能になった時
- `plant_wither`: 作物枯死
- `clean_bucket`: バケツ清掃
- `clean_brush`: ブラシ清掃完了
