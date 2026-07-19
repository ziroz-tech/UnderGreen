(() => {
  "use strict";

  const LABOR_NODE_DEFINITIONS = Object.freeze({
    event: { label: "稼働サイクル開始", kicker: "EVENT", icon: "⚡", description: "稼働中、ここからパルスが流れます。", category: "event", task: "" },
    branch: { label: "分岐", kicker: "BRANCH", icon: "◆", description: "接続したBOOL条件に応じて処理を分けます。", category: "flow", task: "" },
    sequence: { label: "シーケンス", kicker: "SEQUENCE", icon: "≡", description: "上から順に、成立する処理を探します。", category: "flow", task: "" },
    flipflop: { label: "フリップフロップ", kicker: "FLIP FLOP", icon: "⇄", description: "呼ばれるたびにAとBを交互に実行します。", category: "flow", task: "" },
    daily: { label: "1日1回", kicker: "DO ONCE / DAY", icon: "☀", description: "その日の初回と実行済みで処理を分けます。", category: "flow", task: "" },
    every: { label: "Nサイクル毎", kicker: "DO EVERY N", icon: "◔", description: "指定した勤務サイクルごとに処理を分けます。", category: "flow", task: "" },
    random: { label: "気まぐれ", kicker: "RANDOM", icon: "?", description: "指定確率で当たりと外れに処理を分けます。", category: "flow", task: "" },
    condition: { label: "条件", kicker: "CONDITION", icon: "◇", description: "在庫・資源・行動可否などを判定し、BOOL値を出力します。", category: "condition", task: "" },
    harvest: { label: "収穫", kicker: "TASK", icon: "🥬", description: "範囲内で収穫可能な作物を1つ収穫します。", category: "task", task: "harvest" },
    ship: { label: "出荷", kicker: "TASK", icon: "📦", description: "指定した作物を指定市場へ1単位出荷します。", category: "task", task: "ship" },
    plant: { label: "播種", kicker: "TASK", icon: "🌱", description: "指定した種を範囲内の空きスロットへ1つ植えます。", category: "task", task: "plant" },
    procure: { label: "調達", kicker: "TASK", icon: "🛒", description: "指定した種を時価で1〜12パックまとめて購入します。調達端末が必要です。", category: "task", task: "procure" },
    cleaning: { label: "清掃", kicker: "TASK", icon: "🧹", description: "範囲内で汚れている設備を1つ清掃します。", category: "task", task: "cleaning" },
    rest: { label: "充電休憩", kicker: "TASK", icon: "🔋", description: "一定時間作業を止め、完了時に電力を満充電し、気力を少量回復します。", category: "task", task: "" }
  });

  const LABOR_ITEM_TOOLTIPS = Object.freeze({
    summary: { title: "WORKFORCE TOTAL", body: "所有している全サポートロボットの台数と、現在の電力・気力の合計です。" },
    unitName: { title: "UNIT NAME", body: "このロボットの表示名です。初期支給機以外は24文字まで変更でき、拠点名と合わせて個体識別に使われます。" },
    energy: { title: "電力", body: "作業時に最初に消費する基本資源です。残量がある間は通常効率で働き、尽きると気力を使って作業を続けます。" },
    morale: { title: "気力", body: "電力が尽きた後の作業継続に使います。電力と気力の両方を使い切ると1日かけた強制休養に入ります。" },
    location: { title: "LOCATION", body: "このロボットを配置している拠点とグリッド座標です。ブループリントは個体ごとに保存されます。" },
    range: { title: "RANGE", body: "収穫・播種・清掃で届く作業範囲です。対象設備が範囲外にある場合、そのタスクは実行できません。" },
    trait: { title: "TRAIT", body: "この個体の作業特性です。得意な業務のスキル等級や消費資源などに影響します。" },
    personality: { title: "PERSONALITY // {name}", body: "{description}" },
    assignmentStatus: { title: "担当作業", body: "開始ノードから接続され、実際に到達できるタスクの種類を表示します。未接続ノードと充電休憩は含みません。" },
    efficiencyStatus: { title: "効率補正", body: "固有速度、担当構成による個体補正、同拠点支援、現在の気力倍率を合成した実際の作業効率です。" },
    status: { title: "ROBOT STATUS", body: "READY、クールタイム、充電休憩、強制休養など、現在の稼働状態を表示します。クールタイムはロボット個体に属し、タスクごとの値ではありません。" },
    center: { title: "CENTER", body: "配置済みノード全体が編集領域に収まるよう、表示位置とズームを中央へ戻します。ノード配置そのものは変わりません。" },
    packageToggle: { title: "NODE PACKAGE", body: "登録済みのノード構成を開閉します。パッケージは既存の構成を残したまま、独立したノード群として追加されます。" },
    packageCard: { title: "ADD PACKAGE", body: "カードを編集領域へドラッグすると、その位置へパッケージ内の解放済みノードを追加します。内部の配線だけを作成し、開始ノードや既存フローには自動接続しません。短く押すと空いている位置へ追加します。" },

    tooltipToggle: { title: "TOOLTIPS", body: "労務管理画面の詳しい説明表示を切り替えます。初期状態はONで、変更した設定はこのブラウザに保存されます。" },
    simple: { title: "SIMPLE", body: "ノードライブラリにタスクノードだけを表示します。すでに配置したフローノードは消えず、そのまま動作します。" },
    advanced: { title: "ADVANCED", body: "タスクに加えて、分岐・シーケンス・条件など全ノードをライブラリへ表示します。" },
    editor: { title: "BLUEPRINT EDITOR", body: "ノードはヘッダーをドラッグして移動します。出力端子から入力端子へ線を引き、空白ドラッグで移動、ホイールまたはピンチで拡大縮小できます。" },
    library: { title: "NODE LIBRARY", body: "ノードを編集領域へドラッグして配置します。短く押すと空いている位置へ自動配置されます。同じノードを複数置けます。" },
    conditionSource: { title: "CHECK", body: "条件ノードで何を調べるかを選びます。選択内容に応じて、作物・タスク・比較方法などの追加項目が現れます。" },
    actionType: { title: "ACTION", body: "「行動可能」で判定するタスクです。選んだタスクに有効な対象があり、設備・資源・クールタイム等の条件を満たすとTRUEになります。" },
    seed: { title: "SEED", body: "播種・調達・条件判定の対象となる種子を選びます。種子在庫数は、植え付けに使える種子の残数です。" },
    crop: { title: "CROP", body: "出荷または収穫済み在庫の判定対象となる作物を選びます。" },
    market: { title: "TO", body: "出荷先の市場を選びます。市場が未解放、または指定作物を扱えない場合は出荷できません。" },
    packs: { title: "PACKS", body: "1回の調達で購入するパック数です。1〜12の範囲で指定し、支払額は現在価格×パック数になります。" },
    operator: { title: "TEST", body: "CHECKで取得した現在値とVALUEの比較方法です。たとえば「種子在庫数・以下・5」で在庫5以下を判定できます。" },
    value: { title: "VALUE", body: "条件判定で比較する基準値です。直接入力するか、下の−10・−5・＋5・＋10で調整できます。" },
    valueStepper: { title: "VALUE ADJUST", body: "条件値を指定量だけ増減します。長い数値を入力し直さずに微調整できます。" },
    marketReadout: { title: "SEED MARKET", body: "選択した種子1パックの現在価格、調達総額、値動きの方向を表示します。" },
    everyN: { title: "N", body: "Nサイクル毎ノードが「N回目」へ進む間隔です。このノードを通るたびにカウントが1増えます。" },
    probability: { title: "CHANCE", body: "気まぐれノードが「当たり」へ進む確率です。通過するたびに独立して抽選します。" },
    grade: { title: "SKILL GRADE", body: "選択中ロボットの、このタスクに対する技能等級です。個体特性により作業効率や消費量へ補正が入ります。" },
    taskCost: { title: "基本消費", body: "このタスク1回の基本消費量です。原則として電力を使い、電力が尽きた後は気力を消費して作業します。" },
    chargeInfo: { title: "充電休憩", body: "表示時間が経過するまでこの個体は作業しません。完了時に電力を満充電し、表示量だけ気力を回復して「次へ」へ進みます。" },
    runtime: { title: "RUNTIME STATUS", body: "直近の勤務サイクルで、このノードがどう判定・実行されたかを表示します。「—」は直近サイクルで未通過です。" },
    deleteNode: { title: "DELETE NODE", body: "このノードと、接続されているすべての線を削除します。" }
  });

  const LABOR_CONDITION_SOURCE_TOOLTIPS = Object.freeze({
    action_available: "選択したタスクを今すぐ実行できるか判定します。対象・設備・資源・クールタイムなどを含みます。",
    inventory: "選択した作物の収穫済み在庫数を判定します。「すべて」なら全作物の合計です。",
    seed: "選択した種子の在庫数を判定します。植え付けに使える種子の残数です。",
    seed_price: "選択した種子1パックの現在価格を判定します。安値での自動調達に利用できます。",
    money: "現在の所持金を判定します。",
    water: "現在保有している水の量を判定します。",
    nutrient: "現在保有している養液の量を判定します。",
    energy: "選択中ロボットの現在電力を判定します。",
    morale: "選択中ロボットの現在気力を判定します。"
  });

  const LABOR_PALETTE_GROUPS = Object.freeze([
    { label: "TASK", types: ["harvest", "ship", "plant", "procure", "cleaning", "rest"] },
    { label: "FLOW CONTROL", types: ["branch", "sequence", "flipflop", "daily", "every", "random"] },
    { label: "CONDITION", types: ["condition"] }
  ]);
  const LABOR_ADDABLE_TYPES = LABOR_PALETTE_GROUPS.flatMap((group) => group.types);
  const LABOR_BLUEPRINT_PACKAGES = Object.freeze([
    {
      id: "white-work",
      label: "ホワイト労働",

      coreKeys: [],
      nodes: [
        { key: "harvest", type: "harvest", x: 620, y: 300 },
        { key: "plant", type: "plant", x: 900, y: 300, args: { cropId: "lettuce" } },
        { key: "energy", type: "condition", x: 320, y: 410, args: { conditionSource: "energy", operator: "lte", value: 0, cropId: "lettuce" } },
        { key: "branch", type: "branch", x: 320, y: 170, requires: ["energy"] },
        { key: "rest", type: "rest", x: 620, y: 40 }
      ],
      execPaths: [[
        { key: "root", outPin: "out" },
        { key: "branch", outPin: "true" },
        { key: "rest", outPin: "next" }
      ], [
        { key: "branch", outPin: "false" },
        { key: "harvest", outPin: "failure" },
        { key: "plant", outPin: "failure" }
      ]],
      dataLinks: [{ from: "energy", fromPin: "value", to: "branch", toPin: "condition" }]
    },
    {
      id: "workaholic",
      label: "ワーカホリック",

      coreKeys: [],
      nodes: [
        { key: "harvest", type: "harvest", x: 310, y: 130 },
        { key: "ship", type: "ship", x: 560, y: 130, args: { cropId: "lettuce", marketId: "lower" } },
        { key: "plant", type: "plant", x: 810, y: 130, args: { cropId: "lettuce" } },
        { key: "procure", type: "procure", x: 1060, y: 130, args: { cropId: "lettuce", packs: 1 } },
        { key: "cleaning", type: "cleaning", x: 1310, y: 130 }
      ],
      execPaths: [[
        { key: "root", outPin: "out" },
        { key: "harvest", outPin: "failure" },
        { key: "ship", outPin: "failure" },
        { key: "plant", outPin: "failure" },
        { key: "procure", outPin: "failure" },
        { key: "cleaning", outPin: "failure" }
      ]],
      dataLinks: []
    },
    {
      id: "seed-market-reader",
      label: "相場読みの達人（種）",

      coreKeys: ["procure"],
      nodes: [
        { key: "market", type: "condition", x: 330, y: 330, args: { conditionSource: "seed_price", operator: "lt", value: () => seedMarketBasePrice("lettuce"), cropId: "lettuce" } },
        { key: "branch", type: "branch", x: 330, y: 90, requires: ["market"] },
        { key: "procure", type: "procure", x: 620, y: 90, args: { cropId: "lettuce", packs: 1 } }
      ],
      execPaths: [[
        { key: "root", outPin: "out" },
        { key: "branch", outPin: "true" },
        { key: "procure", outPin: "failure" }
      ]],
      dataLinks: [{ from: "market", fromPin: "value", to: "branch", toPin: "condition" }]
    }
  ]);
  const LABOR_BLUEPRINT_COORD_LIMIT = 100000;

  function clampLaborBlueprintCoordinate(value) {
    const coordinate = Number(value);
    if (!Number.isFinite(coordinate)) return 0;
    return Math.max(-LABOR_BLUEPRINT_COORD_LIMIT, Math.min(LABOR_BLUEPRINT_COORD_LIMIT, coordinate));
  }

  let laborPaletteDrag = null;
  let laborPaletteSuppressClickUntil = 0;
  let laborBlueprintPaletteGroup = "TASK";
  const LABOR_TOOLTIP_PREFERENCE_KEY = "undergreen.laborTooltips";
  let laborTooltipsEnabled = (() => {
    try {
      return window.localStorage.getItem(LABOR_TOOLTIP_PREFERENCE_KEY) !== "off";
    } catch (_error) {
      return true;
    }
  })();

  const LABOR_NODE_EXECUTION_NOTES = Object.freeze({
    event: "接続がない場合、この個体はブループリントによる自動作業を行いません。",
    branch: "BOOL入力が未接続なら処理は失敗扱いとなり、その勤務サイクルはそこで止まります。",
    sequence: "①から順に試し、失敗した枝だけ次へ進みます。作業の優先順位づけに使えます。",
    flipflop: "選択先は通過時点で切り替わるため、接続先が失敗しても次回は反対側になります。",
    daily: "初回判定はこのノードを通った時点で記録され、接続先の成功・失敗には左右されません。",
    every: "カウントはこのノードを通るたびに増え、2・3・5サイクル間隔から選べます。",
    random: "抽選はこのノードを通るたびに独立して行われます。",
    condition: "このノード自体は作業を行いません。BOOL出力を分岐ノードのBOOL入力へ接続してください。",
    rest: "充電を開始すると完了までRUNNINGとなり、完了後に「次へ」へ進みます。すでに満充電なら待たずに進みます。"
  });

  const LABOR_TOOLTIP_OVERRIDES = new Map();

  function laborTooltipTemplate(value, replacements = {}) {
    return String(value ?? "").replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(replacements, key)
        ? String(replacements[key] ?? "")
        : match
    ));
  }

  function laborTooltipCopy(id, fallback = {}, replacements = {}) {
    const source = LABOR_TOOLTIP_OVERRIDES.has(id)
      ? LABOR_TOOLTIP_OVERRIDES.get(id)
      : fallback;
    return {
      title: laborTooltipTemplate(source?.title, replacements),
      body: laborTooltipTemplate(source?.body, replacements)
    };
  }

  function laborItemTooltip(key, replacements = {}) {
    return laborTooltipCopy(`item.${key}`, LABOR_ITEM_TOOLTIPS[key] || {}, replacements);
  }

  function configureLaborTooltips(rows = []) {
    LABOR_TOOLTIP_OVERRIDES.clear();
    rows.forEach((row) => {
      const id = String(row?.id || "").trim();
      if (!id) return;
      LABOR_TOOLTIP_OVERRIDES.set(id, {
        title: String(row.title ?? ""),
        body: String(row.body ?? "")
      });
    });
    hideLaborTooltip(true);
    applyLaborStaticTooltips();
  }

  let laborTooltipTarget = null;
  let laborTooltipPinned = false;
  let laborTooltipHideTimer = 0;
  let laborTooltipPointer = null;
  let laborTooltipPreviousDescribedBy = null;

  function laborTooltipAttributes(tooltip, fallbackTitle = "") {
    const entry = typeof tooltip === "string" ? laborItemTooltip(tooltip) : tooltip;
    const body = String(entry?.body || "");
    const title = String(entry?.title || fallbackTitle || "");
    if (!body) return "";
    return 'data-labor-tooltip="' + escapeHtml(body) + '"'
      + (title ? ' data-labor-tooltip-title="' + escapeHtml(title) + '"' : "")
      + ' aria-description="' + escapeHtml(body) + '"';
  }

  function laborNodeTooltip(node, definition, unlock) {
    const genericTaskNote = definition.category === "task" && node.type !== "rest"
      ? "成功するとその勤務サイクルの作業は完了します。実行できなかった場合だけ「次へ」端子へ進みます。"
      : "";
    const note = LABOR_NODE_EXECUTION_NOTES[node.type] || genericTaskNote;
    const fallback = {
      title: definition.kicker + " // " + definition.label,
      body: definition.description + (note ? " " + note : "")
    };
    const tooltip = laborTooltipCopy(`node.${node.type}`, fallback, {
      kicker: definition.kicker,
      label: definition.label
    });
    if (!unlock.unlocked) {
      tooltip.body += laborTooltipCopy("node.locked_suffix", {
        body: " 現在はロック中です: {reason}。"
      }, { reason: unlock.reason }).body;
    }
    return tooltip;
  }

  function laborArgumentTooltip(node, field, label) {
    if (field === "conditionSource") {
      const sourceNote = laborTooltipCopy(`condition.${node.conditionSource}`, {
        body: LABOR_CONDITION_SOURCE_TOOLTIPS[node.conditionSource] || ""
      }).body;
      const base = laborItemTooltip("conditionSource");
      return {
        title: base.title,
        body: base.body + (sourceNote ? laborTooltipCopy("condition.current_suffix", {
          body: " 現在の判定: {condition}"
        }, { condition: sourceNote }).body : "")
      };
    }
    if (field === "actionType") return laborItemTooltip("actionType");
    if (field === "marketId") return laborItemTooltip("market");
    if (field === "packs") return laborItemTooltip("packs");
    if (field === "operator") return laborItemTooltip("operator");
    if (field === "value") return laborItemTooltip("value");
    if (field === "everyN") return laborItemTooltip("everyN");
    if (field === "probability") return laborItemTooltip("probability");
    if (field === "cropId") return label === "CROP" ? laborItemTooltip("crop") : laborItemTooltip("seed");
    return laborTooltipCopy("argument.default", {
      title: "{label}",
      body: "このノードの実行条件または対象を設定します。"
    }, { label });
  }

  function laborPinTooltip(node, pin, direction) {
    const portDirection = direction === "input" ? "INPUT" : "OUTPUT";
    const replacements = {
      label: pin.label,
      direction: portDirection
    };
    if (pin.kind === "boolean") {
      const id = direction === "input" ? "pin.boolean.input" : "pin.boolean.output";
      return laborTooltipCopy(id, {
        title: "{label} // {direction}",
        body: direction === "input"
          ? "条件ノードのBOOL出力をここへ接続します。TRUEまたはFALSEに応じて分岐先が決まります。"
          : "この条件の判定結果をTRUE/FALSEで出力します。分岐ノードのBOOL入力へ接続してください。"
      }, replacements);
    }
    if (direction === "input") {
      return laborTooltipCopy("pin.exec.input", {
        title: "{label} // {direction}",
        body: "実行線の入口です。上流ノードの出力端子からここへ接続すると、処理が到達した際にこのノードを実行します。"
      }, replacements);
    }
    if (pin.id === "failure" && LABOR_NODE_DEFINITIONS[node.type]?.category === "task") {
      return laborTooltipCopy("pin.task.failure", {
        title: "{label} // {direction}",
        body: "対象なし・資源不足・クールタイム中などで、このタスクを実行できなかった場合だけここへ進みます。成功時は勤務サイクルを終了します。"
      }, replacements);
    }

    let id = "pin.output.default";
    let body = "この端子から、次に実行するノードの入力端子へ実行線をつなぎます。";
    if (node.type === "event") {
      id = "pin.output.event";
      body = "勤務サイクル開始時、最初に実行するノードへつなぎます。";
    } else if (node.type === "sequence") {
      id = "pin.output.sequence";
      body = "{label}の優先順位でこの枝を試します。前の枝が失敗した場合にだけ到達します。";
    } else if (node.type === "branch") {
      id = pin.id === "true" ? "pin.output.branch.true" : "pin.output.branch.false";
      body = pin.id === "true" ? "BOOLがTRUEのとき、この枝へ進みます。" : "BOOLがFALSEのとき、この枝へ進みます。";
    } else if (node.type === "flipflop") {
      id = "pin.output.flipflop";
      body = "今回は{label}側が選ばれたとき、この枝へ進みます。";
    } else if (node.type === "daily") {
      id = pin.id === "first" ? "pin.output.daily.first" : "pin.output.daily.repeat";
      body = pin.id === "first"
        ? "その日に初めてこのノードを通ったとき、この枝へ進みます。"
        : "その日の2回目以降は、この枝へ進みます。";
    } else if (node.type === "every") {
      id = pin.id === "nth" ? "pin.output.every.nth" : "pin.output.every.other";
      body = pin.id === "nth"
        ? "通過回数が指定したNの倍数になったとき、この枝へ進みます。"
        : "N回目以外のサイクルでは、この枝へ進みます。";
    } else if (node.type === "random") {
      id = pin.id === "hit" ? "pin.output.random.hit" : "pin.output.random.miss";
      body = pin.id === "hit"
        ? "確率抽選に当たったとき、この枝へ進みます。"
        : "確率抽選から外れたとき、この枝へ進みます。";
    } else if (node.type === "rest") {
      id = "pin.output.rest";
      body = "充電休憩が完了した後にこの枝へ進みます。すでに満充電なら、待たずに進みます。";
    }
    return laborTooltipCopy(id, {
      title: "{label} // {direction}",
      body
    }, replacements);
  }

  function ensureLaborTooltip() {
    let tooltip = document.getElementById("labor-tooltip");
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "labor-tooltip";
    tooltip.className = "labor-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    tooltip.innerHTML = '<strong class="labor-tooltip-title"></strong><span class="labor-tooltip-body"></span>';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function restoreLaborTooltipDescription() {
    if (!laborTooltipTarget?.isConnected) {
      laborTooltipPreviousDescribedBy = null;
      return;
    }
    if (laborTooltipPreviousDescribedBy) {
      laborTooltipTarget.setAttribute("aria-describedby", laborTooltipPreviousDescribedBy);
    } else {
      laborTooltipTarget.removeAttribute("aria-describedby");
    }
    laborTooltipPreviousDescribedBy = null;
  }

  function positionLaborTooltip(target = laborTooltipTarget) {
    const tooltip = document.getElementById("labor-tooltip");
    if (!tooltip || tooltip.hidden || !target?.isConnected) return;
    const margin = 10;
    const gap = 9;
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    let top = targetRect.bottom + gap;
    if (top + tooltipRect.height > window.innerHeight - margin) {
      top = targetRect.top - tooltipRect.height - gap;
    }
    left = Math.max(margin, Math.min(window.innerWidth - tooltipRect.width - margin, left));
    top = Math.max(margin, Math.min(window.innerHeight - tooltipRect.height - margin, top));
    tooltip.style.left = Math.round(left) + "px";
    tooltip.style.top = Math.round(top) + "px";
  }

  function showLaborTooltip(target, { pinned = false } = {}) {
    if (!laborTooltipsEnabled || !target?.isConnected || !target.closest?.("#labor-screen")) return;
    const body = String(target.dataset.laborTooltip || "");
    if (!body) return;
    const tooltip = ensureLaborTooltip();
    clearTimeout(laborTooltipHideTimer);
    if (laborTooltipTarget !== target) {
      restoreLaborTooltipDescription();
      laborTooltipTarget = target;
      laborTooltipPreviousDescribedBy = target.getAttribute("aria-describedby");
    }
    laborTooltipPinned = pinned;
    const title = String(target.dataset.laborTooltipTitle || "");
    const titleElement = tooltip.querySelector(".labor-tooltip-title");
    const bodyElement = tooltip.querySelector(".labor-tooltip-body");
    if (titleElement) {
      titleElement.textContent = title;
      titleElement.hidden = !title;
    }
    if (bodyElement) bodyElement.textContent = body;
    tooltip.hidden = false;
    tooltip.classList.add("visible");
    const describedBy = laborTooltipPreviousDescribedBy
      ? laborTooltipPreviousDescribedBy + " labor-tooltip"
      : "labor-tooltip";
    target.setAttribute("aria-describedby", describedBy);
    requestAnimationFrame(() => positionLaborTooltip(target));
  }

  function hideLaborTooltip(force = false) {
    if (laborTooltipPinned && !force) return;
    clearTimeout(laborTooltipHideTimer);
    laborTooltipHideTimer = 0;
    const tooltip = document.getElementById("labor-tooltip");
    if (tooltip) {
      tooltip.classList.remove("visible");
      tooltip.hidden = true;
    }
    restoreLaborTooltipDescription();
    laborTooltipTarget = null;
    laborTooltipPinned = false;
    laborTooltipPointer = null;
  }

  function scheduleLaborTooltipHide(delay = 4200) {
    clearTimeout(laborTooltipHideTimer);
    laborTooltipHideTimer = window.setTimeout(() => hideLaborTooltip(true), delay);
  }

  function laborTooltipTargetFromEvent(event) {
    if (!laborTooltipsEnabled) return null;
    const target = event.target.closest?.("[data-labor-tooltip]");
    return target?.closest?.("#labor-screen") ? target : null;
  }
  function updateLaborTooltipToggleControl() {
    const input = document.querySelector("[data-labor-tooltip-toggle]");
    const stateLabel = document.querySelector("[data-labor-tooltip-state]");
    if (input) input.checked = laborTooltipsEnabled;
    if (stateLabel) stateLabel.textContent = laborTooltipsEnabled ? "ON" : "OFF";
    document.getElementById("labor-screen")?.classList.toggle("tooltips-disabled", !laborTooltipsEnabled);
  }

  function setLaborTooltipsEnabled(enabled, { persist = true } = {}) {
    laborTooltipsEnabled = enabled !== false;
    if (!laborTooltipsEnabled) hideLaborTooltip(true);
    if (persist) {
      try {
        window.localStorage.setItem(LABOR_TOOLTIP_PREFERENCE_KEY, laborTooltipsEnabled ? "on" : "off");
      } catch (_error) {
        // The control still works for this session when storage is unavailable.
      }
    }
    updateLaborTooltipToggleControl();
  }

  function handleLaborTooltipPointerDown(event) {
    const target = laborTooltipTargetFromEvent(event);
    if (!target && laborTooltipPinned) hideLaborTooltip(true);
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (!target) {
      hideLaborTooltip(true);
      return;
    }
    showLaborTooltip(target, { pinned: true });
    laborTooltipPointer = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
  }

  function handleLaborTooltipPointerMove(event) {
    if (!laborTooltipPointer || laborTooltipPointer.pointerId !== event.pointerId) return;
    if (Math.hypot(
      event.clientX - laborTooltipPointer.startX,
      event.clientY - laborTooltipPointer.startY
    ) < 9) return;
    laborTooltipPointer.moved = true;
    hideLaborTooltip(true);
  }

  function finishLaborTooltipPointer(event, cancelled = false) {
    if (!laborTooltipPointer || laborTooltipPointer.pointerId !== event.pointerId) return;
    const moved = laborTooltipPointer.moved;
    laborTooltipPointer = null;
    if (cancelled || moved) {
      hideLaborTooltip(true);
    } else {
      laborTooltipPinned = true;
      scheduleLaborTooltipHide();
    }
  }

  function setLaborTooltipData(element, key, { focusable = false } = {}) {
    const entry = laborItemTooltip(key);
    if (!element || !entry) return;
    element.dataset.laborTooltip = entry.body;
    element.dataset.laborTooltipTitle = entry.title;
    element.setAttribute("aria-description", entry.body);
    if (focusable && !element.matches("button,input,select,textarea,a[href]")) {
      element.tabIndex = 0;
    }
  }

  function applyLaborStaticTooltips() {
    setLaborTooltipData(document.getElementById("labor-summary"), "summary", { focusable: true });
    setLaborTooltipData(document.querySelector("[data-blueprint-center]"), "center");
    setLaborTooltipData(document.querySelector("[data-blueprint-package-toggle]"), "packageToggle");

    setLaborTooltipData(document.querySelector(".labor-tooltip-toggle"), "tooltipToggle");
    setLaborTooltipData(document.getElementById("labor-blueprint-editor"), "editor", { focusable: true });
    setLaborTooltipData(document.querySelector(".blueprint-palette-panel"), "library", { focusable: true });
  }

  function supportBlueprintNodeDefinition(type) {
    return LABOR_NODE_DEFINITIONS[type] || LABOR_NODE_DEFINITIONS.event;
  }

  function laborPinSchema(type) {
    if (typeof supportBlueprintPinSchema === "function") return supportBlueprintPinSchema(type);
    return { inputs: [], outputs: [] };
  }

  function laborPinDefinition(type, direction, pinId) {
    const list = direction === "input" ? laborPinSchema(type).inputs : laborPinSchema(type).outputs;
    return list.find((pin) => pin.id === pinId) || null;
  }

  function laborDefaultPin(type, direction, kind = "exec") {
    const list = direction === "input" ? laborPinSchema(type).inputs : laborPinSchema(type).outputs;
    return list.find((pin) => pin.kind === kind)?.id || "";
  }

  function supportBlueprintNodeUnlockState(type) {
    if (type === "harvest") {
      return state.supportOS?.harvest
        ? { unlocked: true, reason: "収穫OS ONLINE" }
        : { unlocked: false, reason: "収穫OSが必要" };
    }
    if (type === "plant") {
      return state.supportOS?.planting
        ? { unlocked: true, reason: "植え付けOS ONLINE" }
        : { unlocked: false, reason: "植え付けOSが必要" };
    }
    if (type === "cleaning") {
      return state.supportOS?.cleaning
        ? { unlocked: true, reason: "お掃除OS ONLINE" }
        : { unlocked: false, reason: "お掃除OSが必要" };
    }
    if (type === "ship") {
      const hasHatch = ownedBases().some((base) => (
        base.floorDevices?.some((device) => device.type === "shipping_hatch")
      ));
      return hasHatch
        ? { unlocked: true, reason: "搬出口 ONLINE" }
        : { unlocked: false, reason: "出荷用搬出口が必要" };
    }
    if (type === "procure") {
      const hasTerminal = ownedBases().some((base) => (
        base.floorDevices?.some((device) => device.type === "procurement_terminal")
      ));
      return hasTerminal
        ? { unlocked: true, reason: "調達端末 ONLINE" }
        : { unlocked: false, reason: "設置型調達端末が必要" };
    }
    return { unlocked: true, reason: "ONLINE" };
  }

  function laborBlueprintPackageById(packageId) {
    return LABOR_BLUEPRINT_PACKAGES.find((entry) => entry.id === packageId) || LABOR_BLUEPRINT_PACKAGES[0];
  }

  function laborBlueprintPackageStatus(packageDefinition) {
    const unlockByKey = new Map();
    const activeKeys = new Set();
    const skippedByKey = new Map();
    packageDefinition.nodes.forEach((node) => {
      const unlock = supportBlueprintNodeUnlockState(node.type);
      unlockByKey.set(node.key, unlock);
      if (unlock.unlocked) {
        activeKeys.add(node.key);
      } else {
        skippedByKey.set(node.key, {
          key: node.key,
          type: node.type,
          label: supportBlueprintNodeDefinition(node.type).label,
          reason: unlock.reason
        });
      }
    });

    let changed = true;
    while (changed) {
      changed = false;
      packageDefinition.nodes.forEach((node) => {
        if (!activeKeys.has(node.key)) return;
        const missingRequirement = (node.requires || []).find((key) => !activeKeys.has(key));
        if (!missingRequirement) return;
        activeKeys.delete(node.key);
        skippedByKey.set(node.key, {
          key: node.key,
          type: node.type,
          label: supportBlueprintNodeDefinition(node.type).label,
          reason: "前提ノードが未解放"
        });
        changed = true;
      });
    }

    const coreLocks = (packageDefinition.coreKeys || []).map((key) => {
      const node = packageDefinition.nodes.find((entry) => entry.key === key);
      const unlock = node ? unlockByKey.get(key) : null;
      if (!node || unlock?.unlocked) return null;
      return {
        key,
        type: node.type,
        label: supportBlueprintNodeDefinition(node.type).label,
        reason: unlock.reason
      };
    }).filter(Boolean);

    const noActiveNodes = activeKeys.size === 0;
    return {
      selectable: coreLocks.length === 0 && !noActiveNodes,
      activeKeys,
      skipped: [...skippedByKey.values()],
      coreLocks,
      noActiveNodes
    };
  }

  function resolveLaborBlueprintPackageArgs(args = {}) {
    return Object.fromEntries(Object.entries(args).map(([field, value]) => [
      field,
      typeof value === "function" ? value() : value
    ]));
  }

  function createLaborBlueprintPackageLink(links, nodeByKey, fromKey, fromPin, toKey, toPin) {
    const fromNode = nodeByKey.get(fromKey);
    const toNode = nodeByKey.get(toKey);
    if (!fromNode || !toNode) return;
    const output = laborPinDefinition(fromNode.type, "output", fromPin);
    const input = laborPinDefinition(toNode.type, "input", toPin);
    if (!output || !input || output.kind !== input.kind) return;
    links.push({
      id: makeId("bp-link"),
      from: fromNode.id,
      fromPin,
      to: toNode.id,
      toPin,
      order: links.length
    });
  }

  function appendSupportBlueprintPackage(sourceBlueprint, packageDefinition, status, dropPosition = null) {
    const blueprint = normalizeSupportBlueprint(sourceBlueprint);
    const activeDefinitions = packageDefinition.nodes.filter((definition) => status.activeKeys.has(definition.key));
    if (!activeDefinitions.length) {
      return { blueprint, addedNodeIds: [] };
    }

    const packageMinX = Math.min(...activeDefinitions.map((definition) => Number(definition.x) || 0));
    const packageMinY = Math.min(...activeDefinitions.map((definition) => Number(definition.y) || 0));
    const existingNodes = blueprint.nodes.filter((node) => node.type !== "event");
    const droppedX = Number(dropPosition?.x);
    const droppedY = Number(dropPosition?.y);
    const hasDropPosition = Number.isFinite(droppedX) && Number.isFinite(droppedY);
    const anchorX = hasDropPosition
      ? clampLaborBlueprintCoordinate(Math.round(droppedX))
      : existingNodes.length
        ? Math.max(260, Math.min(...existingNodes.map((node) => Number(node.x) || 0)))
        : 320;
    const anchorY = hasDropPosition
      ? clampLaborBlueprintCoordinate(Math.round(droppedY))
      : existingNodes.length
        ? Math.max(...existingNodes.map((node) => Number(node.y) || 0)) + 360
        : 90;
    const nodeByKey = new Map();
    const addedNodes = activeDefinitions.map((definition) => {
      const node = {
        id: makeId("bp-node"),
        type: definition.type,
        x: clampLaborBlueprintCoordinate(anchorX + (Number(definition.x) || 0) - packageMinX),
        y: clampLaborBlueprintCoordinate(anchorY + (Number(definition.y) || 0) - packageMinY),
        ...resolveLaborBlueprintPackageArgs(definition.args)
      };
      nodeByKey.set(definition.key, node);
      return node;
    });

    const links = [...blueprint.links];
    packageDefinition.execPaths.forEach((rawPath) => {
      const path = rawPath.filter((entry) => nodeByKey.has(entry.key));
      for (let index = 0; index < path.length - 1; index += 1) {
        const fromEntry = path[index];
        const toEntry = path[index + 1];
        const fromNode = nodeByKey.get(fromEntry.key);
        const toNode = nodeByKey.get(toEntry.key);
        const fromPin = fromEntry.outPin || laborDefaultPin(fromNode.type, "output", "exec");
        const toPin = toEntry.inPin || laborDefaultPin(toNode.type, "input", "exec");
        createLaborBlueprintPackageLink(
          links,
          nodeByKey,
          fromEntry.key,
          fromPin,
          toEntry.key,
          toPin
        );
      }
    });
    packageDefinition.dataLinks.forEach((link) => {
      createLaborBlueprintPackageLink(
        links,
        nodeByKey,
        link.from,
        link.fromPin,
        link.to,
        link.toPin
      );
    });

    return {
      blueprint: normalizeSupportBlueprint({
        version: 3,
        rootId: blueprint.rootId,
        nodes: [...blueprint.nodes, ...addedNodes],
        links
      }),
      addedNodeIds: addedNodes.map((node) => node.id)
    };
  }

  function laborBlueprintPackageCardTooltip(packageDefinition, status, record) {
    const replacements = { packageLabel: packageDefinition.label };
    const title = laborTooltipCopy("package.title", {
      title: "ADD PACKAGE // {packageLabel}"
    }, replacements).title;
    if (!record) {
      return {
        title,
        body: laborTooltipCopy("package.no_robot", {
          body: "追加先のサポートロボットを選択してください。"
        }, replacements).body
      };
    }
    if (status.coreLocks.length) {
      const lock = status.coreLocks[0];
      return {
        title,
        body: laborTooltipCopy("package.core_locked", {
          body: "コア「{coreLabel}」が未解放のため追加できません: {reason}。"
        }, {
          ...replacements,
          coreLabel: lock.label,
          reason: lock.reason
        }).body
      };
    }
    if (status.noActiveNodes) {
      return {
        title,
        body: laborTooltipCopy("package.no_active", {
          body: "このパッケージに含まれるノードは、現在すべて未解放です。"
        }, replacements).body
      };
    }
    const skippedNote = status.skipped.length
      ? laborTooltipCopy("package.skipped_suffix", {
        body: " 未解放の {skippedNodes} は省略します。"
      }, {
        ...replacements,
        skippedNodes: status.skipped.map((entry) => entry.label).join("・")
      }).body
      : "";
    return {
      title,
      body: laborItemTooltip("packageCard").body + skippedNote
    };
  }

  function renderLaborBlueprintPackageCards(record) {
    const list = document.querySelector("[data-blueprint-package-list]");
    if (!list) return;

    list.innerHTML = LABOR_BLUEPRINT_PACKAGES.map((packageDefinition) => {
      const status = laborBlueprintPackageStatus(packageDefinition);
      const disabled = !record || !status.selectable;
      let availability = status.activeKeys.size + " NODES READY";
      if (!record) availability = "NO UNIT";
      else if (status.coreLocks.length) availability = status.coreLocks[0].label + " LOCKED";
      else if (status.noActiveNodes) availability = "NO ACTIVE NODES";
      const tooltip = laborBlueprintPackageCardTooltip(packageDefinition, status, record);
      return `<div class="blueprint-palette-entry blueprint-package-entry" ${laborTooltipAttributes(tooltip)} tabindex="${disabled ? 0 : -1}">
        <button class="blueprint-package-card" data-blueprint-package-add="${escapeHtml(packageDefinition.id)}" type="button" ${disabled ? "disabled" : ""}>
          <strong>＋ ${escapeHtml(packageDefinition.label)}</strong>
          <small>${escapeHtml(availability)}</small>
        </button>
      </div>`;
    }).join("");
  }
  function addLaborBlueprintPackage(packageId, dropPosition = null) {
    const record = selectedLaborRobotRecord();
    const packageDefinition = laborBlueprintPackageById(packageId);
    const status = laborBlueprintPackageStatus(packageDefinition);
    if (!record) return;
    if (!status.selectable) {
      const lock = status.coreLocks[0];
      const message = lock
        ? "コア「" + lock.label + "」が未解放です: " + lock.reason
        : "このパッケージには現在利用できるノードがありません。";
      toast(message, "warning");
      rejectFeedback();
      return;
    }

    const result = appendSupportBlueprintPackage(
      record.robot.supportBlueprint,
      packageDefinition,
      status,
      dropPosition
    );
    if (!result.addedNodeIds.length) {
      toast("追加できるノードがありません。", "warning");
      rejectFeedback();
      return;
    }
    record.robot.supportBlueprint = result.blueprint;
    resetLaborRobotBlueprintRuntime(record.robot);
    saveGame();
    renderLaborBlueprint();
    const skippedSuffix = status.skipped.length ? "（未解放ノードは省略）" : "";
    toast(packageDefinition.label + "を追加しました。" + skippedSuffix, "success");
    playSoundFirst(["ui_click", "tab_switch"], 0.14);
  }
  function selectedLaborRobotRecord() {
    const roster = supportRobotRoster();
    if (!roster.length) {
      selectedLaborRobotId = "";
      return null;
    }
    let record = roster.find(({ robot }) => robot.id === selectedLaborRobotId);
    if (!record) {
      record = roster[0];
      selectedLaborRobotId = record.robot.id;
    }
    ensureSupportRobotProfile(record.robot);
    return record;
  }

  function supportBlueprintNodeById(blueprint, nodeId) {
    return blueprint?.nodes?.find((node) => node.id === nodeId) || null;
  }

  function supportBlueprintHasPath(blueprint, startId, goalId) {
    const pending = [startId];
    const visited = new Set();
    while (pending.length) {
      const currentId = pending.pop();
      if (currentId === goalId) return true;
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);
      blueprint.links
        .filter((link) => link.from === currentId)
        .forEach((link) => pending.push(link.to));
    }
    return false;
  }

  function nextSupportBlueprintLinkOrder(blueprint) {
    return blueprint.links.reduce((max, link) => Math.max(max, Number(link.order) || 0), -1) + 1;
  }

  function resetLaborRobotBlueprintRuntime(robot) {
    if (typeof resetSupportBlueprintRuntime === "function") resetSupportBlueprintRuntime(robot);
  }

  function connectSupportBlueprintPins(fromId, fromPin, toId, toPin, { render = true, persist = true } = {}) {
    const record = selectedLaborRobotRecord();
    if (!record) return false;
    const blueprint = record.robot.supportBlueprint;
    const from = supportBlueprintNodeById(blueprint, fromId);
    const to = supportBlueprintNodeById(blueprint, toId);
    const output = from ? laborPinDefinition(from.type, "output", fromPin) : null;
    const input = to ? laborPinDefinition(to.type, "input", toPin) : null;
    if (!from || !to || from.id === to.id || !output || !input || output.kind !== input.kind) {
      rejectFeedback();
      return false;
    }
    if (supportBlueprintHasPath(blueprint, to.id, from.id)) {
      toast("循環する接続は作成できません。", "warning");
      rejectFeedback();
      return false;
    }

    let links = [...blueprint.links];
    if (Number.isFinite(input.maxLinks)) {
      const existing = links.filter((link) => link.to === to.id && link.toPin === toPin);
      if (existing.length >= input.maxLinks) {
        links = links.filter((link) => !(link.to === to.id && link.toPin === toPin));
      }
    }
    if (Number.isFinite(output.maxLinks)) {
      const existing = links.filter((link) => link.from === from.id && link.fromPin === fromPin);
      if (existing.length >= output.maxLinks) {
        links = links.filter((link) => !(link.from === from.id && link.fromPin === fromPin));
      }
    }
    const duplicate = links.some((link) => (
      link.from === from.id && link.fromPin === fromPin && link.to === to.id && link.toPin === toPin
    ));
    if (!duplicate) {
      links.push({
        id: makeId("bp-link"),
        from: from.id,
        fromPin,
        to: to.id,
        toPin,
        order: nextSupportBlueprintLinkOrder(blueprint)
      });
    }
    blueprint.links = links;
    record.robot.supportBlueprint = normalizeSupportBlueprint(blueprint);
    resetLaborRobotBlueprintRuntime(record.robot);
    if (persist) saveGame();
    if (render) renderLaborBlueprint();
    return true;
  }

  function disconnectSupportBlueprintInput(nodeId, pinId) {
    const record = selectedLaborRobotRecord();
    if (!record) return false;
    const blueprint = record.robot.supportBlueprint;
    const nextLinks = blueprint.links.filter((link) => !(link.to === nodeId && link.toPin === pinId));
    if (nextLinks.length === blueprint.links.length) return false;
    blueprint.links = nextLinks;
    resetLaborRobotBlueprintRuntime(record.robot);
    saveGame();
    renderLaborBlueprint();
    playSoundFirst(["ui_click", "tab_switch"], 0.08);
    return true;
  }

  function defaultBlueprintCropId() {
    if (CROPS[selectedSeed] && isUnlocked("seed_item", selectedSeed)) return selectedSeed;
    return Object.keys(CROPS).find((cropId) => isUnlocked("seed_item", cropId)) || "lettuce";
  }

  function defaultBlueprintMarketId() {
    return isMarketAvailable(selectedMarket) ? selectedMarket : "lower";
  }

  function addSupportBlueprintNode(type, dropPosition = null) {
    const record = selectedLaborRobotRecord();
    if (!record || !LABOR_ADDABLE_TYPES.includes(type)) return;
    const unlock = supportBlueprintNodeUnlockState(type);
    if (!unlock.unlocked) {
      toast(unlock.reason, "warning");
      rejectFeedback();
      return;
    }
    const blueprint = record.robot.supportBlueprint;
    const index = Math.max(0, blueprint.nodes.length - 1);
    const droppedX = Number(dropPosition?.x);
    const droppedY = Number(dropPosition?.y);
    const hasDropPosition = Number.isFinite(droppedX) && Number.isFinite(droppedY);
    const node = {
      id: makeId("bp-node"),
      type,
      x: hasDropPosition ? clampLaborBlueprintCoordinate(Math.round(droppedX)) : 330 + (index % 3) * 285,
      y: hasDropPosition ? clampLaborBlueprintCoordinate(Math.round(droppedY)) : 90 + Math.floor(index / 3) * 215
    };
    if (type === "plant") node.cropId = defaultBlueprintCropId();
    if (type === "procure") {
      node.cropId = defaultBlueprintCropId();
      node.packs = 1;
    }
    if (type === "ship") {
      node.cropId = defaultBlueprintCropId();
      node.marketId = defaultBlueprintMarketId();
    }
    if (type === "every") node.everyN = 3;
    if (type === "random") node.probability = 50;
    if (type === "condition") {
      node.conditionSource = "action_available";
      node.operator = "gte";
      node.value = 1;
      node.cropId = defaultBlueprintCropId();
      node.actionType = "plant";
      node.marketId = defaultBlueprintMarketId();
      node.packs = 1;
    }
    blueprint.nodes.push(node);

    const root = supportBlueprintNodeById(blueprint, blueprint.rootId);
    const rootOut = root ? laborDefaultPin(root.type, "output", "exec") : "";
    const nodeIn = laborDefaultPin(node.type, "input", "exec");
    const rootConnected = root && blueprint.links.some((link) => link.from === root.id && link.fromPin === rootOut);
    if (root && rootOut && nodeIn && !rootConnected) {
      connectSupportBlueprintPins(root.id, rootOut, node.id, nodeIn, { render: false, persist: false });
    }
    record.robot.supportBlueprint = normalizeSupportBlueprint(record.robot.supportBlueprint);
    resetLaborRobotBlueprintRuntime(record.robot);
    saveGame();
    renderLaborBlueprint();
    playSoundFirst(["ui_click", "tab_switch"], 0.12);
  }

  function removeSupportBlueprintNode(nodeId) {
    const record = selectedLaborRobotRecord();
    if (!record) return;
    const blueprint = record.robot.supportBlueprint;
    const node = supportBlueprintNodeById(blueprint, nodeId);
    if (!node || node.type === "event") return;
    blueprint.nodes = blueprint.nodes.filter((entry) => entry.id !== nodeId);
    blueprint.links = blueprint.links.filter((link) => link.from !== nodeId && link.to !== nodeId);
    record.robot.supportBlueprint = normalizeSupportBlueprint(blueprint);
    resetLaborRobotBlueprintRuntime(record.robot);
    saveGame();
    renderLaborBlueprint();
  }

  function updateSupportBlueprintNodeArg(nodeId, field, value) {
    const record = selectedLaborRobotRecord();
    if (!record) return;
    const node = supportBlueprintNodeById(record.robot.supportBlueprint, nodeId);
    if (!node) return;
    if (field === "cropId" && (value === "*" || CROPS[value])) node.cropId = value;
    if (field === "marketId" && MARKETS[value]) node.marketId = value;
    if (field === "conditionSource" && ["action_available", "inventory", "seed", "seed_price", "money", "water", "nutrient", "energy", "morale"].includes(value)) {
      node.conditionSource = value;
    }
    if (field === "operator" && ["gte", "gt", "lte", "lt", "eq"].includes(value)) node.operator = value;
    if (field === "actionType" && ["harvest", "ship", "plant", "procure", "cleaning"].includes(value)) node.actionType = value;
    if (field === "everyN" && [2, 3, 5].includes(Number(value))) node.everyN = Number(value);
    if (field === "probability" && [25, 50, 75].includes(Number(value))) node.probability = Number(value);
    if (field === "value") node.value = Math.max(0, Math.min(999999, Number(value) || 0));
    if (field === "packs") node.packs = Math.max(1, Math.min(12, Math.floor(Number(value) || 1)));
    record.robot.supportBlueprint = normalizeSupportBlueprint(record.robot.supportBlueprint);
    resetLaborRobotBlueprintRuntime(record.robot);
    saveGame();
    renderLaborBlueprint();
  }
  function blueprintCropOptions(selectedCropId, { planting = false, includeAll = false } = {}) {
    const allOption = includeAll
      ? `<option value="*" ${selectedCropId === "*" ? "selected" : ""}>全作物</option>`
      : "";
    return allOption + Object.entries(CROPS).map(([cropId, crop]) => {
      const locked = planting && !isUnlocked("seed_item", cropId);
      return `<option value="${escapeHtml(cropId)}" ${cropId === selectedCropId ? "selected" : ""} ${locked ? "disabled" : ""}>${escapeHtml(crop.name)}${locked ? " [LOCKED]" : ""}</option>`;
    }).join("");
  }

  function blueprintMarketOptions(selectedMarketId) {
    return Object.entries(MARKETS).map(([marketId, market]) => {
      const locked = !isMarketAvailable(marketId);
      return `<option value="${escapeHtml(marketId)}" ${marketId === selectedMarketId ? "selected" : ""} ${locked ? "disabled" : ""}>${escapeHtml(market.name)}${locked ? " [LOCKED]" : ""}</option>`;
    }).join("");
  }

  function blueprintActionOptions(selectedType) {
    return ["harvest", "ship", "plant", "procure", "cleaning"].map((type) => {
      const definition = supportBlueprintNodeDefinition(type);
      const unlock = supportBlueprintNodeUnlockState(type);
      return `<option value="${type}" ${type === selectedType ? "selected" : ""} ${unlock.unlocked ? "" : "disabled"}>${escapeHtml(definition.label)}${unlock.unlocked ? "" : " [LOCKED]"}</option>`;
    }).join("");
  }

  function blueprintConditionSourceOptions(selectedSource) {
    const sources = [
      ["action_available", "行動可能"],
      ["inventory", "在庫数"],
      ["seed", "種子在庫数"],
      ["seed_price", "種子時価"],
      ["money", "所持金"],
      ["water", "水"],
      ["nutrient", "養液"],
      ["energy", "電力"],
      ["morale", "気力"]
    ];
    return sources.map(([value, label]) => (
      `<option value="${value}" ${value === selectedSource ? "selected" : ""}>${label}</option>`
    )).join("");
  }

  function blueprintOperatorOptions(selectedOperator) {
    const operators = [
      ["gte", "以上"],
      ["gt", "より大きい"],
      ["lte", "以下"],
      ["lt", "より小さい"],
      ["eq", "等しい"]
    ];
    return operators.map(([value, label]) => (
      `<option value="${value}" ${value === selectedOperator ? "selected" : ""}>${label}</option>`
    )).join("");
  }

  function blueprintArgSelect(node, field, label, options) {
    const tooltip = laborArgumentTooltip(node, field, label);
    return `<label ${laborTooltipAttributes(tooltip, label)}>${label}<select data-blueprint-arg="${field}" data-blueprint-node="${escapeHtml(node.id)}">${options}</select></label>`;
  }

  function blueprintPacksInput(node, label = "PACKS") {
    return '<label ' + laborTooltipAttributes("packs", label) + '>' + label + '<input type="number" min="1" max="12" step="1" value="'
      + escapeHtml(node.packs || 1) + '" data-blueprint-arg="packs" data-blueprint-node="'
      + escapeHtml(node.id) + '"></label>';
  }

  function blueprintSeedMarketReadout(cropId, packs = 0) {
    const resolvedCropId = CROPS[cropId] ? cropId : "lettuce";
    const trend = seedPriceTrend(resolvedCropId);
    const packCount = Math.max(0, Math.min(12, Math.floor(Number(packs) || 0)));
    const total = packCount > 0 ? ' / TOTAL ₡' + formatNumber(trend.current * packCount) : "";
    return '<div class="blueprint-market-readout" tabindex="0" ' + laborTooltipAttributes("marketReadout") + '><span>NOW</span><strong>₡'
      + formatNumber(trend.current) + total + '</strong><small class="' + escapeHtml(trend.direction)
      + '">' + escapeHtml(trend.label) + '</small></div>';
  }

  function supportBlueprintConditionArgsMarkup(node) {
    const sourceSelect = blueprintArgSelect(
      node,
      "conditionSource",
      "CHECK",
      blueprintConditionSourceOptions(node.conditionSource)
    );
    if (node.conditionSource === "action_available") {
      const actionSelect = blueprintArgSelect(node, "actionType", "ACTION", blueprintActionOptions(node.actionType));
      const cropSelect = ["plant", "ship", "procure"].includes(node.actionType)
        ? blueprintArgSelect(
          node,
          "cropId",
          node.actionType === "ship" ? "CROP" : "SEED",
          blueprintCropOptions(node.cropId, { planting: ["plant", "procure"].includes(node.actionType) })
        )
        : "";
      const marketSelect = node.actionType === "ship"
        ? blueprintArgSelect(node, "marketId", "TO", blueprintMarketOptions(node.marketId))
        : "";
      const packsInput = node.actionType === "procure" ? blueprintPacksInput(node) : "";
      return `<div class="blueprint-node-args condition-args">${sourceSelect}${actionSelect}${cropSelect}${marketSelect}${packsInput}</div>`;
    }

    const cropSelect = ["inventory", "seed", "seed_price"].includes(node.conditionSource)
      ? blueprintArgSelect(
        node,
        "cropId",
        node.conditionSource === "inventory" ? "CROP" : "SEED",
        blueprintCropOptions(node.cropId, {
          planting: ["seed", "seed_price"].includes(node.conditionSource),
          includeAll: node.conditionSource === "inventory"
        })
      )
      : "";
    const operatorSelect = blueprintArgSelect(node, "operator", "TEST", blueprintOperatorOptions(node.operator));
    const marketReadout = node.conditionSource === "seed_price" ? blueprintSeedMarketReadout(node.cropId) : "";
    const valueInput = `<div class="blueprint-value-control">
      <label ${laborTooltipAttributes("value", "VALUE")}>VALUE<input type="number" inputmode="numeric" min="0" max="999999" step="1" value="${escapeHtml(node.value)}" data-blueprint-arg="value" data-blueprint-node="${escapeHtml(node.id)}" aria-label="条件値"></label>
      <div class="blueprint-number-stepper" ${laborTooltipAttributes("valueStepper")} aria-label="条件値の増減">
        <button type="button" data-blueprint-value-delta="-10" data-blueprint-node="${escapeHtml(node.id)}" title="10減らす">-10</button>
        <button type="button" data-blueprint-value-delta="-5" data-blueprint-node="${escapeHtml(node.id)}" title="5減らす">-5</button>
        <button type="button" data-blueprint-value-delta="5" data-blueprint-node="${escapeHtml(node.id)}" title="5増やす">+5</button>
        <button type="button" data-blueprint-value-delta="10" data-blueprint-node="${escapeHtml(node.id)}" title="10増やす">+10</button>
      </div>
    </div>`;
    return `<div class="blueprint-node-args condition-args">${sourceSelect}${cropSelect}${operatorSelect}${valueInput}${marketReadout}</div>`;
  }

  function supportBlueprintNodeArgsMarkup(node) {
    if (node.type === "condition") return supportBlueprintConditionArgsMarkup(node);
    if (node.type === "plant") {
      return `<div class="blueprint-node-args">
        ${blueprintArgSelect(node, "cropId", "SEED", blueprintCropOptions(node.cropId, { planting: true }))}
      </div>`;
    }
    if (node.type === "procure") {
      return '<div class="blueprint-node-args">'
        + blueprintArgSelect(node, "cropId", "SEED", blueprintCropOptions(node.cropId, { planting: true }))
        + blueprintPacksInput(node)
        + blueprintSeedMarketReadout(node.cropId, node.packs)
        + '</div>';
    }
    if (node.type === "ship") {
      return `<div class="blueprint-node-args">
        ${blueprintArgSelect(node, "cropId", "CROP", blueprintCropOptions(node.cropId))}
        ${blueprintArgSelect(node, "marketId", "TO", blueprintMarketOptions(node.marketId))}
      </div>`;
    }
    if (node.type === "every") {
      const options = [2, 3, 5].map((value) => (
        `<option value="${value}" ${Number(node.everyN) === value ? "selected" : ""}>N = ${value}</option>`
      )).join("");
      return `<div class="blueprint-node-args">${blueprintArgSelect(node, "everyN", "N", options)}</div>`;
    }
    if (node.type === "random") {
      const options = [25, 50, 75].map((value) => (
        `<option value="${value}" ${Number(node.probability) === value ? "selected" : ""}>${value}%</option>`
      )).join("");
      return `<div class="blueprint-node-args">${blueprintArgSelect(node, "probability", "CHANCE", options)}</div>`;
    }
    return "";
  }

  function supportBlueprintOrderedOutgoing(blueprint, nodeId, pinId) {
    return blueprint.links
      .filter((link) => link.from === nodeId && link.fromPin === pinId)
      .sort((left, right) => {
        const leftNode = supportBlueprintNodeById(blueprint, left.to);
        const rightNode = supportBlueprintNodeById(blueprint, right.to);
        const yDelta = (Number(leftNode?.y) || 0) - (Number(rightNode?.y) || 0);
        if (Math.abs(yDelta) > 0.001) return yDelta;
        const xDelta = (Number(leftNode?.x) || 0) - (Number(rightNode?.x) || 0);
        if (Math.abs(xDelta) > 0.001) return xDelta;
        return (Number(left.order) || 0) - (Number(right.order) || 0);
      });
  }

  function supportBlueprintPinStackMarkup(node, direction, blueprint) {
    const pins = direction === "input" ? laborPinSchema(node.type).inputs : laborPinSchema(node.type).outputs;
    if (!pins.length) return `<div class="blueprint-pin-stack ${direction}-stack"></div>`;
    const entries = pins.map((pin) => {
      const links = direction === "input"
        ? blueprint.links.filter((link) => link.to === node.id && link.toPin === pin.id)
        : blueprint.links.filter((link) => link.from === node.id && link.fromPin === pin.id);
      const label = pin.label;
      const tooltip = laborPinTooltip(node, pin, direction);
      return `<div class="blueprint-pin-entry ${pin.kind}-pin ${links.length ? "connected" : ""}" ${laborTooltipAttributes(tooltip, label)}>
        <button class="blueprint-pin ${direction} ${pin.kind}"
          data-blueprint-pin-direction="${direction}"
          data-blueprint-pin-id="${escapeHtml(pin.id)}"
          data-blueprint-pin-kind="${escapeHtml(pin.kind)}"
          data-blueprint-node="${escapeHtml(node.id)}"
          type="button"
          aria-label="${escapeHtml(label)}端子"></button>
        <span class="blueprint-pin-cap">${escapeHtml(label)}${direction === "output" && links.length > 1 ? ` · ${links.length}` : ""}</span>
      </div>`;
    }).join("");
    return `<div class="blueprint-pin-stack ${direction}-stack">${entries}</div>`;
  }

  function supportBlueprintNodeMarkup(node, robot, blueprint) {
    const definition = supportBlueprintNodeDefinition(node.type);
    const isEvent = node.type === "event";
    const unlock = supportBlueprintNodeUnlockState(node.type);
    const task = definition.task;
    const grade = task ? supportTaskGrade(robot, task) : "";
    const cost = task ? Math.round(supportRobotEnergyCost(robot, task) * 10) / 10 : 0;
    const isChargeBreak = node.type === "rest";
    const nodeTooltip = laborNodeTooltip(node, definition, unlock);

    const runtime = robot.supportBlueprintRuntime || {};
    const runtimeBadge = runtime.nodeBadges?.[node.id] || null;
    const isActive = runtime.activeNodeId === node.id;
    const isLast = runtime.lastNodeId === node.id;
    const statusText = isActive
      ? runtimeBadge?.text || "RUNNING"
      : runtimeBadge?.text
        || (isLast ? String(runtime.lastStatus || "failure").toUpperCase() : definition.category === "condition" ? "BOOL" : "—");
    const statusKind = isActive ? "ok" : runtimeBadge?.kind || (!unlock.unlocked ? "block" : "");
    const categoryClass = `${definition.category}-node`;
    return `<article class="blueprint-node ${categoryClass} ${unlock.unlocked ? "" : "locked-node"} ${isActive ? "runtime-active" : ""} ${isLast ? "runtime-last" : ""}"
      data-blueprint-node-id="${escapeHtml(node.id)}"
      data-cat="${escapeHtml(definition.category)}"
      ${laborTooltipAttributes(nodeTooltip)}
      tabindex="0"
      style="left:${Number(node.x) || 0}px;top:${Number(node.y) || 0}px">
      <header class="blueprint-node-header" data-blueprint-drag="${escapeHtml(node.id)}">
        <span class="blueprint-node-icon" aria-hidden="true">${definition.icon}</span>
        <strong class="blueprint-node-name">${escapeHtml(definition.label)}</strong>
        <small class="blueprint-node-kicker">${escapeHtml(definition.kicker)}</small>
        ${isEvent ? "" : `<button class="blueprint-node-delete" data-blueprint-delete="${escapeHtml(node.id)}" ${laborTooltipAttributes("deleteNode")} type="button" aria-label="ノードを削除">×</button>`}
      </header>
      <div class="blueprint-node-body">
        ${supportBlueprintNodeArgsMarkup(node)}
        <div class="blueprint-pin-rows">
          ${supportBlueprintPinStackMarkup(node, "input", blueprint)}
          ${supportBlueprintPinStackMarkup(node, "output", blueprint)}
        </div>
        ${task ? `<div class="blueprint-node-grade ${escapeHtml(grade)}" ${laborTooltipAttributes("grade")} tabindex="0">${escapeHtml(grade)}</div>
          <div class="blueprint-node-info" ${laborTooltipAttributes("taskCost")} tabindex="0"><span>基本消費 <b>${escapeHtml(cost)}</b> / 電力→気力</span></div>` : ""}
        ${isChargeBreak ? `<div class="blueprint-node-info" ${laborTooltipAttributes("chargeInfo")} tabindex="0"><span>所要 <b>${supportRobotChargeBreakDays().toFixed(2)} DAY</b> / 電力満充電 / 気力+${supportRobotChargeMoraleRecovery()}</span></div>` : ""}
        ${isEvent ? `<p class="blueprint-node-event-copy">${escapeHtml(definition.description)}</p>` : ""}
        ${isEvent ? "" : `<div class="blueprint-node-badge ${escapeHtml(statusKind)}" data-blueprint-runtime="${escapeHtml(node.id)}" ${laborTooltipAttributes("runtime")} tabindex="0">${escapeHtml(statusText)}</div>`}
      </div>
    </article>`;
  }
  function laborRobotStatusText(robot) {
    if (supportRobotIsCharging(robot)) {
      const seconds = supportRobotChargeRemainingDays(robot) * REALTIME_DAY_MS / 1000;
      return `${supportRobotIsForcedRecovery(robot) ? "FORCED REST" : "CHARGING"} ${seconds.toFixed(1)} SEC`;
    }
    const cooldown = Math.max(0, Number(robot.supportCooldown) || 0);
    return cooldown > 0 ? `${cooldown.toFixed(2)} DAY` : "READY";
  }

  function laborPercent(value, signed = false) {
    const rounded = Math.round((Number(value) || 0) * 1000) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${signed && rounded > 0 ? "+" : ""}${text}%`;
  }

  function laborAssignedTaskMarkup(taskTypes) {
    if (!taskTypes.length) return `<span class="labor-assignment-empty">担当なし</span>`;
    return taskTypes.map((taskType) => {
      const definition = LABOR_NODE_DEFINITIONS[taskType];
      return `<span class="labor-assignment-chip">${escapeHtml(definition?.label || taskType)}</span>`;
    }).join("");
  }

  function laborPersonalityTagMarkup(robot) {
    const personalityIds = supportRobotPersonalityIds(robot);
    const personalities = supportRobotPersonalities(robot);
    return personalities.map((personality, index) => `<span class="labor-personality-tag" ${laborTooltipAttributes(laborItemTooltip("personality", {
      name: personality.name || personalityIds[index],
      description: personality.description || "性格特性の説明は未設定です。"
    }))} tabindex="0">${escapeHtml(personality.name || personalityIds[index])}</span>`).join("");
  }
  function renderLaborRobotDetail(record) {
    const detail = document.getElementById("labor-robot-detail");
    if (!detail) return;
    if (!record) {
      detail.innerHTML = `<div class="inventory-empty">NO SUPPORT UNIT</div>`;
      return;
    }
    const { base, robot } = record;
    const maxEnergy = supportRobotMaxEnergy(robot);
    const maxMorale = supportRobotMaxMorale(robot);
    const energy = Math.max(0, Math.min(maxEnergy, Number(robot.supportEnergy) || 0));
    const morale = Math.max(0, Math.min(maxMorale, Number(robot.supportMorale) || 0));
    const efficiencyBreakdown = supportRobotEfficiencyBreakdown(robot);
    const skill = supportRobotSkill(robot);
    const personalityRarity = supportRobotPersonalityRarity(robot);
    detail.innerHTML = `
      <label class="labor-name-field" ${laborTooltipAttributes("unitName")}>
        <span>UNIT NAME ${robot.isInitialSupportRobot ? "// INITIAL UNIT" : "// EDITABLE"}</span>
        <input data-labor-name="${escapeHtml(robot.id)}" value="${escapeHtml(supportRobotDisplayName(robot))}" maxlength="24" ${robot.isInitialSupportRobot ? "disabled" : ""}>
      </label>
      <div class="labor-stat" ${laborTooltipAttributes("energy")} tabindex="0">
        <div class="labor-stat-head"><span>電力</span><strong data-labor-energy-value>${Math.round(energy)} / ${Math.round(maxEnergy)}</strong></div>
        <div class="labor-stat-track"><i data-labor-energy-bar style="width:${maxEnergy ? energy / maxEnergy * 100 : 0}%"></i></div>
      </div>
      <div class="labor-stat morale" ${laborTooltipAttributes("morale")} tabindex="0">
        <div class="labor-stat-head"><span>気力</span><strong data-labor-morale-value>${Math.round(morale)} / ${Math.round(maxMorale)}</strong></div>
        <div class="labor-stat-track"><i data-labor-morale-bar style="width:${maxMorale ? morale / maxMorale * 100 : 0}%"></i></div>
      </div>
      <div class="labor-profile-grid">
        <div ${laborTooltipAttributes("location")} tabindex="0"><small>LOCATION</small><strong>${escapeHtml(supportRobotLocationLabel(base, robot))}</strong></div>
        <div ${laborTooltipAttributes("range")} tabindex="0"><small>RANGE</small><strong>${escapeHtml(supportRobotRange(robot))} GRID</strong></div>
        <div ${laborTooltipAttributes("trait")} tabindex="0"><small>TRAIT</small><strong>${escapeHtml(skill.name || robot.robotSkillId)}</strong></div>
        <div class="labor-personality-profile wide">
          <span class="labor-personality-head"><small>PERSONALITY TAGS</small><b class="labor-rarity-badge" style="--personality-rarity-color:${escapeHtml(personalityRarity.color)}">${escapeHtml(personalityRarity.name)}</b></span>
          <div class="labor-personality-tags">${laborPersonalityTagMarkup(robot)}</div>
        </div>
        <div class="wide" ${laborTooltipAttributes("status")} tabindex="0"><small>ROBOT STATUS</small><strong data-labor-cooldown-value>${laborRobotStatusText(robot)}</strong></div>
      </div>
      <section class="labor-current-section" ${laborTooltipAttributes("assignmentStatus")} tabindex="0">
        <header class="labor-current-head">
          <span><small>CURRENT ASSIGNMENT</small><strong>担当作業</strong></span>
          <b data-labor-assignment-count>${efficiencyBreakdown.assignedTaskCount}種類</b>
        </header>
        <div class="labor-assignment-list" data-labor-assignment-list>${laborAssignedTaskMarkup(efficiencyBreakdown.assignedTaskTypes)}</div>
      </section>
      <section class="labor-current-section labor-efficiency-section" ${laborTooltipAttributes("efficiencyStatus")} tabindex="0">
        <header class="labor-current-head">
          <span><small>EFFICIENCY BREAKDOWN</small><strong>効率補正</strong></span>
          <b class="labor-efficiency-total" data-labor-efficiency-total>${laborPercent(efficiencyBreakdown.totalEfficiency)}</b>
        </header>
        <dl class="labor-efficiency-breakdown">
          <div><dt>固有速度</dt><dd data-labor-efficiency-speed>${laborPercent(efficiencyBreakdown.baseSpeedModifier - 1, true)}</dd></div>
          <div><dt>担当構成</dt><dd data-labor-efficiency-self>${laborPercent(efficiencyBreakdown.selfBonus, true)}</dd></div>
          <div><dt>同拠点支援</dt><dd data-labor-efficiency-team>${laborPercent(efficiencyBreakdown.teamBonus, true)}</dd></div>
          <div><dt>気力倍率</dt><dd data-labor-efficiency-morale>${laborPercent(efficiencyBreakdown.moraleEfficiency)}</dd></div>
        </dl>
      </section>`;
  }

  function resizeLaborBlueprintWorld(nodes) {
    const world = document.getElementById("labor-blueprint-world");
    const svg = document.getElementById("labor-blueprint-wires");
    const width = Math.max(1900, ...nodes.map((node) => (Number(node.x) || 0) + 420));
    const height = Math.max(1200, ...nodes.map((node) => (Number(node.y) || 0) + 390));
    if (world) {
      world.style.width = `${width}px`;
      world.style.height = `${height}px`;
    }
    if (svg) {
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.style.width = `${width}px`;
      svg.style.height = `${height}px`;
    }
  }

  function renderLaborBlueprint(refreshRobotDetail = true) {
    const nodesHost = document.getElementById("labor-blueprint-nodes");
    const palette = document.getElementById("blueprint-node-palette");
    const label = document.getElementById("blueprint-robot-label");
    const emptyHint = document.getElementById("blueprint-empty-hint");
    const record = selectedLaborRobotRecord();
    if (!nodesHost || !palette || !label) return;
    if (refreshRobotDetail) renderLaborRobotDetail(record);
    renderLaborBlueprintPackageCards(record);
    if (!record) {
      label.textContent = "NO UNIT";
      nodesHost.innerHTML = "";
      palette.innerHTML = "";
      if (emptyHint) emptyHint.hidden = false;
      renderLaborBlueprintWires();
      return;
    }

    const { base, robot } = record;
    const blueprint = robot.supportBlueprint;
    resizeLaborBlueprintWorld(blueprint.nodes);
    label.textContent = `${supportRobotDisplayName(robot)} // ${supportRobotLocationLabel(base, robot)}`;
    nodesHost.innerHTML = blueprint.nodes.map((node) => (
      supportBlueprintNodeMarkup(node, robot, blueprint)
    )).join("");
    const availablePaletteGroups = LABOR_PALETTE_GROUPS;
    if (!availablePaletteGroups.some((group) => group.label === laborBlueprintPaletteGroup)) {
      laborBlueprintPaletteGroup = "TASK";
    }
    const paletteGroups = availablePaletteGroups.filter((group) => group.label === laborBlueprintPaletteGroup);
    const categoryTabs = `<div class="blueprint-palette-tabs" role="tablist" aria-label="ノードの種類">
      ${availablePaletteGroups.map((group) => {
        const active = group.label === laborBlueprintPaletteGroup;
        const tabLabel = group.label === "FLOW CONTROL" ? "制御" : group.label === "CONDITION" ? "条件" : "作業";
        const tabCode = group.label === "FLOW CONTROL" ? "FLOW" : group.label === "CONDITION" ? "COND" : "TASK";
        return `<button class="${active ? "active" : ""}" data-blueprint-palette-group="${escapeHtml(group.label)}" role="tab" type="button" title="${tabLabel}ノード" aria-label="${tabLabel}ノード" aria-selected="${active}"><span>${tabLabel}</span><small>${tabCode}</small></button>`;
      }).join("")}
    </div>`;
    palette.innerHTML = categoryTabs + paletteGroups.map((group) => {
      const buttons = group.types.map((type) => {
        const definition = supportBlueprintNodeDefinition(type);
        const unlock = supportBlueprintNodeUnlockState(type);
        return `<div class="blueprint-palette-entry" ${laborTooltipAttributes(laborNodeTooltip({ type }, definition, unlock))} tabindex="${unlock.unlocked ? -1 : 0}">
          <button class="blueprint-add-node ${definition.category}-palette" data-blueprint-add="${escapeHtml(type)}" type="button" ${unlock.unlocked ? "" : "disabled"}>
          <strong>＋ ${escapeHtml(definition.label)}</strong>
          <small>${escapeHtml(unlock.reason)} / 複数配置可</small>
        </button></div>`;
      }).join("");
      return `<section class="blueprint-palette-group"><h4>${group.label}</h4>${buttons}</section>`;
    }).join("");
    if (laborTooltipTarget && !laborTooltipTarget.isConnected) hideLaborTooltip(true);
    const rootOut = laborDefaultPin("event", "output", "exec");
    const hasProgram = blueprint.links.some((link) => link.from === blueprint.rootId && link.fromPin === rootOut);
    if (emptyHint) emptyHint.hidden = hasProgram;
    requestAnimationFrame(() => {
      applyLaborBlueprintView();
      renderLaborBlueprintWires();
      updateLaborBlueprintRuntime();
    });
  }

  function laborRobotRarityMarkup(robot) {
    const rarity = supportRobotPersonalityRarity(robot);
    return `<b class="labor-rarity-badge compact" style="--personality-rarity-color:${escapeHtml(rarity.color)}">${escapeHtml(rarity.name)}</b>`;
  }
  function renderLabor() {
    const summary = document.getElementById("labor-summary");
    const list = document.getElementById("labor-robot-list");
    if (!summary || !list) return;
    const roster = supportRobotRoster();
    const record = selectedLaborRobotRecord();
    const totalEnergy = roster.reduce((sum, entry) => sum + (Number(entry.robot.supportEnergy) || 0), 0);
    const totalMorale = roster.reduce((sum, entry) => sum + (Number(entry.robot.supportMorale) || 0), 0);
    summary.innerHTML = `<span>${roster.length} UNITS</span><strong>電力 ${Math.round(totalEnergy)} / 気力 ${Math.round(totalMorale)}</strong>`;
    const sprite = FLOOR_DEVICES.support_robot?.sprite || FLOOR_DEVICES.support_robot?.icon || "";
    list.innerHTML = roster.map(({ base, robot }) => `
      <button class="labor-robot-card ${robot.id === record?.robot.id ? "active" : ""}" data-labor-robot="${escapeHtml(robot.id)}" ${laborTooltipAttributes(laborTooltipCopy("robot.select", {
        title: "SELECT UNIT // {robotName}",
        body: "この個体を選択し、配置拠点・電力・気力・特性と、個体専用のブループリントを表示します."
      }, { robotName: supportRobotDisplayName(robot) }))} type="button">
        <img src="${escapeHtml(sprite)}" alt="">
        <span><span class="labor-robot-card-heading"><strong>${escapeHtml(supportRobotDisplayName(robot))}</strong>${laborRobotRarityMarkup(robot)}</span><small>${escapeHtml(supportRobotLocationLabel(base, robot))}<br>電力 ${Math.round(Number(robot.supportEnergy) || 0)} / 気力 ${Math.round(Number(robot.supportMorale) || 0)}</small></span>
      </button>
    `).join("") || `<div class="inventory-empty">NO SUPPORT UNIT</div>`;
    renderLaborRobotDetail(record);
    renderLaborBlueprint(false);
  }

  function updateLaborRobotVitals() {
    const record = selectedLaborRobotRecord();
    if (!record) return;
    const robot = record.robot;
    const maxEnergy = supportRobotMaxEnergy(robot);
    const maxMorale = supportRobotMaxMorale(robot);
    const energy = Math.max(0, Math.min(maxEnergy, Number(robot.supportEnergy) || 0));
    const morale = Math.max(0, Math.min(maxMorale, Number(robot.supportMorale) || 0));
    const efficiencyBreakdown = supportRobotEfficiencyBreakdown(robot);
    const energyValue = document.querySelector("[data-labor-energy-value]");
    const moraleValue = document.querySelector("[data-labor-morale-value]");
    const energyBar = document.querySelector("[data-labor-energy-bar]");
    const moraleBar = document.querySelector("[data-labor-morale-bar]");
    const cooldownValue = document.querySelector("[data-labor-cooldown-value]");
    if (energyValue) energyValue.textContent = `${Math.round(energy)} / ${Math.round(maxEnergy)}`;
    if (moraleValue) moraleValue.textContent = `${Math.round(morale)} / ${Math.round(maxMorale)}`;
    if (energyBar) energyBar.style.width = `${maxEnergy ? energy / maxEnergy * 100 : 0}%`;
    if (moraleBar) moraleBar.style.width = `${maxMorale ? morale / maxMorale * 100 : 0}%`;
    if (cooldownValue) {
      cooldownValue.textContent = laborRobotStatusText(robot);
    }
    const assignmentCount = document.querySelector("[data-labor-assignment-count]");
    const assignmentList = document.querySelector("[data-labor-assignment-list]");
    const speedValue = document.querySelector("[data-labor-efficiency-speed]");
    const selfValue = document.querySelector("[data-labor-efficiency-self]");
    const teamValue = document.querySelector("[data-labor-efficiency-team]");
    const moraleEfficiencyValue = document.querySelector("[data-labor-efficiency-morale]");
    const totalEfficiencyValue = document.querySelector("[data-labor-efficiency-total]");
    if (assignmentCount) assignmentCount.textContent = `${efficiencyBreakdown.assignedTaskCount}種類`;
    if (assignmentList) assignmentList.innerHTML = laborAssignedTaskMarkup(efficiencyBreakdown.assignedTaskTypes);
    if (speedValue) speedValue.textContent = laborPercent(efficiencyBreakdown.baseSpeedModifier - 1, true);
    if (selfValue) selfValue.textContent = laborPercent(efficiencyBreakdown.selfBonus, true);
    if (teamValue) teamValue.textContent = laborPercent(efficiencyBreakdown.teamBonus, true);
    if (moraleEfficiencyValue) moraleEfficiencyValue.textContent = laborPercent(efficiencyBreakdown.moraleEfficiency);
    if (totalEfficiencyValue) totalEfficiencyValue.textContent = laborPercent(efficiencyBreakdown.totalEfficiency);

    const roster = supportRobotRoster();
    const summary = document.getElementById("labor-summary");
    const totalEnergy = roster.reduce((sum, entry) => sum + (Number(entry.robot.supportEnergy) || 0), 0);
    const totalMorale = roster.reduce((sum, entry) => sum + (Number(entry.robot.supportMorale) || 0), 0);
    if (summary) {
      summary.innerHTML = `<span>${roster.length} UNITS</span><strong>電力 ${Math.round(totalEnergy)} / 気力 ${Math.round(totalMorale)}</strong>`;
    }
    const cards = [...document.querySelectorAll("[data-labor-robot]")];
    roster.forEach(({ base, robot: rosterRobot }) => {
      const card = cards.find((element) => element.dataset.laborRobot === rosterRobot.id);
      const detail = card?.querySelector("small");
      if (detail) {
        detail.innerHTML = `${escapeHtml(supportRobotLocationLabel(base, rosterRobot))}<br>電力 ${Math.round(Number(rosterRobot.supportEnergy) || 0)} / 気力 ${Math.round(Number(rosterRobot.supportMorale) || 0)}`;
      }
    });
  }

  function updateLaborBlueprintRuntime() {
    const record = selectedLaborRobotRecord();
    if (!record) return;
    const runtime = record.robot.supportBlueprintRuntime || {};
    document.querySelectorAll("[data-blueprint-node-id]").forEach((element) => {
      const nodeId = element.dataset.blueprintNodeId;
      const active = nodeId === runtime.activeNodeId;
      const last = nodeId === runtime.lastNodeId;
      const runtimeBadge = runtime.nodeBadges?.[nodeId] || null;
      element.classList.toggle("runtime-active", active);
      element.classList.toggle("runtime-last", last);
      const status = element.querySelector("[data-blueprint-runtime]");
      if (status) {
        status.textContent = active
          ? runtimeBadge?.text || "RUNNING"
          : runtimeBadge?.text
            || (last ? String(runtime.lastStatus || "failure").toUpperCase() : element.classList.contains("condition-node") ? "BOOL" : "—");
        status.classList.remove("ok", "skip", "block");
        const statusKind = active ? "ok" : runtimeBadge?.kind || (element.classList.contains("locked-node") ? "block" : "");
        if (statusKind) status.classList.add(statusKind);
      }
    });
  }
  function laborBlueprintNodeElement(nodeId) {
    return [...document.querySelectorAll("[data-blueprint-node-id]")]
      .find((element) => element.dataset.blueprintNodeId === nodeId) || null;
  }

  function laborBlueprintPinElement(nodeId, direction, pinId) {
    return [...document.querySelectorAll("[data-blueprint-pin-direction]")]
      .find((element) => (
        element.dataset.blueprintNode === nodeId
        && element.dataset.blueprintPinDirection === direction
        && element.dataset.blueprintPinId === pinId
      )) || null;
  }

  function applyLaborBlueprintView() {
    const world = document.getElementById("labor-blueprint-world");
    if (!world) return;
    const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
    laborBlueprintView.x = Math.round(laborBlueprintView.x * dpr) / dpr;
    laborBlueprintView.y = Math.round(laborBlueprintView.y * dpr) / dpr;
    laborBlueprintView.zoom = Math.round(laborBlueprintView.zoom * 1000) / 1000;
    world.style.transform = `translate(${laborBlueprintView.x}px, ${laborBlueprintView.y}px) scale(${laborBlueprintView.zoom})`;
  }

  function laborBlueprintWorldPoint(clientX, clientY) {
    const editor = document.getElementById("labor-blueprint-editor");
    if (!editor) return { x: 0, y: 0 };
    const rect = editor.getBoundingClientRect();
    return {
      x: (clientX - rect.left - laborBlueprintView.x) / laborBlueprintView.zoom,
      y: (clientY - rect.top - laborBlueprintView.y) / laborBlueprintView.zoom
    };
  }

  function laborBlueprintPinPoint(nodeId, direction, pinId) {
    const pin = laborBlueprintPinElement(nodeId, direction, pinId);
    const editor = document.getElementById("labor-blueprint-editor");
    if (!pin || !editor) return null;
    const pinRect = pin.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    return {
      x: (pinRect.left + pinRect.width / 2 - editorRect.left - laborBlueprintView.x) / laborBlueprintView.zoom,
      y: (pinRect.top + pinRect.height / 2 - editorRect.top - laborBlueprintView.y) / laborBlueprintView.zoom
    };
  }

  function supportBlueprintWirePath(from, to) {
    const distance = Math.max(70, Math.abs(to.x - from.x) * 0.48);
    return `M ${from.x} ${from.y} C ${from.x + distance} ${from.y}, ${to.x - distance} ${to.y}, ${to.x} ${to.y}`;
  }

  function supportBlueprintWireKind(blueprint, link) {
    const node = supportBlueprintNodeById(blueprint, link.from);
    return laborPinDefinition(node?.type, "output", link.fromPin)?.kind || "exec";
  }

  function renderLaborBlueprintWires() {
    const svg = document.getElementById("labor-blueprint-wires");
    const record = selectedLaborRobotRecord();
    if (!svg) return;
    if (!record) {
      svg.innerHTML = "";
      return;
    }
    const blueprint = record.robot.supportBlueprint;
    const wireMarkup = blueprint.links.map((link) => {
      const from = laborBlueprintPinPoint(link.from, "output", link.fromPin);
      const to = laborBlueprintPinPoint(link.to, "input", link.toPin);
      if (!from || !to) return "";
      const kind = supportBlueprintWireKind(blueprint, link);
      return `<path class="blueprint-wire ${kind === "boolean" ? "boolean-wire" : "exec-wire"}" d="${supportBlueprintWirePath(from, to)}"></path>`;
    }).join("");
    let previewMarkup = "";
    if (laborBlueprintWireDrag) {
      const from = laborBlueprintPinPoint(
        laborBlueprintWireDrag.fromId,
        "output",
        laborBlueprintWireDrag.fromPin
      );
      if (from) {
        const to = laborBlueprintWireDrag.current || from;
        previewMarkup = `<path class="blueprint-wire preview ${laborBlueprintWireDrag.kind === "boolean" ? "boolean-wire" : "exec-wire"}" d="${supportBlueprintWirePath(from, to)}"></path>`;
      }
    }
    svg.innerHTML = wireMarkup + previewMarkup;
  }

  function centerLaborBlueprintView() {
    const editor = document.getElementById("labor-blueprint-editor");
    const record = selectedLaborRobotRecord();
    if (!editor || !record) return;
    const nodes = record.robot.supportBlueprint.nodes;
    const minX = Math.min(...nodes.map((node) => Number(node.x) || 0));
    const minY = Math.min(...nodes.map((node) => Number(node.y) || 0));
    const maxX = Math.max(...nodes.map((node) => (Number(node.x) || 0) + 270));
    const maxY = Math.max(...nodes.map((node) => (Number(node.y) || 0) + 300));
    const width = Math.max(300, maxX - minX);
    const height = Math.max(200, maxY - minY);
    const fitZoom = Math.min(
      (editor.clientWidth - 70) / width,
      (editor.clientHeight - 70) / height
    );
    const zoom = fitZoom >= 1 ? 1 : Math.max(0.42, Math.floor(fitZoom * 20) / 20);
    laborBlueprintView = {
      zoom,
      x: (editor.clientWidth - width * zoom) / 2 - minX * zoom,
      y: (editor.clientHeight - height * zoom) / 2 - minY * zoom
    };
    applyLaborBlueprintView();
    renderLaborBlueprintWires();
  }

  function zoomLaborBlueprintAt(clientX, clientY, nextZoom) {
    const editor = document.getElementById("labor-blueprint-editor");
    if (!editor) return;
    const rect = editor.getBoundingClientRect();
    const previousZoom = laborBlueprintView.zoom;
    const worldX = (clientX - rect.left - laborBlueprintView.x) / previousZoom;
    const worldY = (clientY - rect.top - laborBlueprintView.y) / previousZoom;
    const zoom = Math.max(0.35, Math.min(1.65, nextZoom));
    laborBlueprintView.zoom = zoom;
    laborBlueprintView.x = clientX - rect.left - worldX * zoom;
    laborBlueprintView.y = clientY - rect.top - worldY * zoom;
    applyLaborBlueprintView();
    renderLaborBlueprintWires();
  }
  function clearLaborBlueprintPinTargets() {
    document.querySelectorAll(".blueprint-pin.wire-target").forEach((pin) => pin.classList.remove("wire-target"));
  }

  function matchingLaborBlueprintInputAt(clientX, clientY, wireDrag) {
    const target = document.elementFromPoint(clientX, clientY)?.closest?.("[data-blueprint-pin-direction='input']");
    if (!target || !wireDrag) return null;
    if (target.dataset.blueprintPinKind !== wireDrag.kind) return null;
    if (target.dataset.blueprintNode === wireDrag.fromId) return null;
    return target;
  }

  function laborPaletteDropEditorAt(clientX, clientY) {
    return document.elementFromPoint(clientX, clientY)?.closest?.("#labor-blueprint-editor") || null;
  }

  function positionLaborPaletteDragGhost(drag, clientX, clientY) {
    if (!drag?.ghost) return;
    drag.ghost.style.left = `${clientX}px`;
    drag.ghost.style.top = `${clientY}px`;
  }

  function updateLaborPaletteDropTarget(clientX, clientY) {
    const editor = document.getElementById("labor-blueprint-editor");
    const target = laborPaletteDropEditorAt(clientX, clientY);
    editor?.classList.toggle("palette-drop-target", Boolean(target));
    return target;
  }

  function clearLaborPaletteDrag() {
    const drag = laborPaletteDrag;
    laborPaletteDrag = null;
    drag?.source?.classList.remove("drag-source");
    drag?.ghost?.remove();
    document.body.classList.remove("blueprint-palette-dragging");
    document.getElementById("labor-blueprint-editor")?.classList.remove("palette-drop-target");
    if (!drag) return;
    try {
      if (drag.source?.hasPointerCapture?.(drag.pointerId)) drag.source.releasePointerCapture(drag.pointerId);
    } catch {
    }
  }

  function beginLaborPaletteDrag(event, button) {
    if (!button || button.disabled || (event.pointerType === "mouse" && event.button !== 0)) return false;
    const type = button.dataset.blueprintAdd;
    const packageId = button.dataset.blueprintPackageAdd;
    let dragItem = null;

    if (type) {
      const definition = supportBlueprintNodeDefinition(type);
      if (!LABOR_ADDABLE_TYPES.includes(type)) return false;
      dragItem = {
        kind: "node",
        type,
        kicker: definition.kicker,
        label: definition.label,
        categoryClass: `${definition.category}-node`
      };
    } else if (packageId) {
      const packageDefinition = laborBlueprintPackageById(packageId);
      const status = laborBlueprintPackageStatus(packageDefinition);
      if (!status.selectable) return false;
      dragItem = {
        kind: "package",
        packageId,
        kicker: "NODE PACKAGE",
        label: packageDefinition.label,
        categoryClass: "package-node"
      };
    }
    if (!dragItem) return false;

    const ghost = document.createElement("div");
    ghost.className = `blueprint-palette-drag-ghost ${dragItem.categoryClass}`;
    ghost.innerHTML = `<small>${escapeHtml(dragItem.kicker)}</small><strong>${escapeHtml(dragItem.label)}</strong>`;
    document.documentElement.appendChild(ghost);
    laborPaletteDrag = {
      pointerId: event.pointerId,
      ...dragItem,
      source: button,
      ghost,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    positionLaborPaletteDragGhost(laborPaletteDrag, event.clientX, event.clientY);
    button.classList.add("drag-source");
    document.body.classList.add("blueprint-palette-dragging");
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
    }
    event.preventDefault();
    return true;
  }

  function moveLaborPaletteDrag(event) {
    const drag = laborPaletteDrag;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 6) {
      drag.moved = true;
      drag.ghost?.classList.add("active");
    }
    positionLaborPaletteDragGhost(drag, event.clientX, event.clientY);
    updateLaborPaletteDropTarget(event.clientX, event.clientY);
    event.preventDefault();
    return true;
  }

  function finishLaborPaletteDrag(event, cancelled = false) {
    const drag = laborPaletteDrag;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    const editor = !cancelled && drag.moved ? laborPaletteDropEditorAt(event.clientX, event.clientY) : null;
    const point = editor ? laborBlueprintWorldPoint(event.clientX, event.clientY) : null;
    const addFromTap = !cancelled && !drag.moved;
    laborPaletteSuppressClickUntil = Date.now() + 450;
    clearLaborPaletteDrag();
    const dropPosition = point
      ? { x: point.x - 120, y: point.y - 55 }
      : null;
    if (drag.kind === "package") {
      if (dropPosition || addFromTap) addLaborBlueprintPackage(drag.packageId, dropPosition);
    } else if (dropPosition) {
      addSupportBlueprintNode(drag.type, dropPosition);
    } else if (addFromTap) {
      addSupportBlueprintNode(drag.type);
    }
    event.preventDefault();
    return true;
  }

  function clearLaborBlueprintInteraction() {
    clearLaborPaletteDrag();
    laborBlueprintPointers.clear();
    laborBlueprintDrag = null;
    laborBlueprintWireDrag = null;
    laborBlueprintPan = null;
    laborBlueprintPinch = null;
    clearLaborBlueprintPinTargets();
    const editor = document.getElementById("labor-blueprint-editor");
    editor?.classList.remove("dragging", "panning");
    renderLaborBlueprintWires();
  }

  function beginLaborBlueprintPinch() {
    const points = [...laborBlueprintPointers.values()].slice(0, 2);
    const editor = document.getElementById("labor-blueprint-editor");
    if (points.length < 2 || !editor) return;
    const centerX = (points[0].x + points[1].x) / 2;
    const centerY = (points[0].y + points[1].y) / 2;
    const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const world = laborBlueprintWorldPoint(centerX, centerY);
    laborBlueprintPinch = {
      startDistance: Math.max(1, distance),
      startZoom: laborBlueprintView.zoom,
      worldX: world.x,
      worldY: world.y
    };
    laborBlueprintDrag = null;
    laborBlueprintWireDrag = null;
    laborBlueprintPan = null;
    clearLaborBlueprintPinTargets();
    editor.classList.add("panning");
  }

  function handleLaborBlueprintPointerDown(event) {
    const paletteButton = event.target.closest?.("[data-blueprint-add],[data-blueprint-package-add]");
    if (paletteButton) return beginLaborPaletteDrag(event, paletteButton);
    const editor = event.target.closest?.("#labor-blueprint-editor");
    if (!editor || (event.pointerType === "mouse" && event.button !== 0)) return false;
    if (event.target.closest("select,input") || event.target.closest("[data-blueprint-delete],[data-blueprint-value-delta]")) return false;

    const inputPin = event.target.closest("[data-blueprint-pin-direction='input']");
    if (inputPin) {
      disconnectSupportBlueprintInput(inputPin.dataset.blueprintNode, inputPin.dataset.blueprintPinId);
      event.preventDefault();
      return true;
    }

    laborBlueprintPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      editor.setPointerCapture(event.pointerId);
    } catch {
    }

    if (laborBlueprintPointers.size >= 2) {
      beginLaborBlueprintPinch();
      event.preventDefault();
      return true;
    }

    const pin = event.target.closest("[data-blueprint-pin-direction='output']");
    if (pin) {
      laborBlueprintWireDrag = {
        pointerId: event.pointerId,
        fromId: pin.dataset.blueprintNode,
        fromPin: pin.dataset.blueprintPinId,
        kind: pin.dataset.blueprintPinKind,
        current: laborBlueprintWorldPoint(event.clientX, event.clientY)
      };
      editor.classList.add("dragging");
      renderLaborBlueprintWires();
      event.preventDefault();
      return true;
    }

    const header = event.target.closest("[data-blueprint-drag]");
    if (header) {
      const record = selectedLaborRobotRecord();
      const nodeId = header.dataset.blueprintDrag;
      const node = supportBlueprintNodeById(record?.robot.supportBlueprint, nodeId);
      if (node) {
        const point = laborBlueprintWorldPoint(event.clientX, event.clientY);
        laborBlueprintDrag = {
          pointerId: event.pointerId,
          nodeId,
          offsetX: point.x - Number(node.x || 0),
          offsetY: point.y - Number(node.y || 0)
        };
        editor.classList.add("dragging");
        event.preventDefault();
        return true;
      }
    }

    laborBlueprintPan = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: laborBlueprintView.x,
      viewY: laborBlueprintView.y
    };
    editor.classList.add("panning");
    event.preventDefault();
    return true;
  }

  function handleLaborBlueprintPointerMove(event) {
    if (laborPaletteDrag?.pointerId === event.pointerId) return moveLaborPaletteDrag(event);
    if (!laborBlueprintPointers.has(event.pointerId)) return false;
    laborBlueprintPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const editor = document.getElementById("labor-blueprint-editor");
    if (!editor) return false;

    if (laborBlueprintPinch && laborBlueprintPointers.size >= 2) {
      const points = [...laborBlueprintPointers.values()].slice(0, 2);
      const centerX = (points[0].x + points[1].x) / 2;
      const centerY = (points[0].y + points[1].y) / 2;
      const distance = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
      const rect = editor.getBoundingClientRect();
      const zoom = Math.max(0.35, Math.min(1.65, laborBlueprintPinch.startZoom * distance / laborBlueprintPinch.startDistance));
      laborBlueprintView.zoom = zoom;
      laborBlueprintView.x = centerX - rect.left - laborBlueprintPinch.worldX * zoom;
      laborBlueprintView.y = centerY - rect.top - laborBlueprintPinch.worldY * zoom;
      applyLaborBlueprintView();
      renderLaborBlueprintWires();
      event.preventDefault();
      return true;
    }

    if (laborBlueprintWireDrag?.pointerId === event.pointerId) {
      laborBlueprintWireDrag.current = laborBlueprintWorldPoint(event.clientX, event.clientY);
      clearLaborBlueprintPinTargets();
      const target = matchingLaborBlueprintInputAt(event.clientX, event.clientY, laborBlueprintWireDrag);
      if (target) target.classList.add("wire-target");
      renderLaborBlueprintWires();
      event.preventDefault();
      return true;
    }

    if (laborBlueprintDrag?.pointerId === event.pointerId) {
      const record = selectedLaborRobotRecord();
      const node = supportBlueprintNodeById(record?.robot.supportBlueprint, laborBlueprintDrag.nodeId);
      if (node) {
        const point = laborBlueprintWorldPoint(event.clientX, event.clientY);
        node.x = clampLaborBlueprintCoordinate(point.x - laborBlueprintDrag.offsetX);
        node.y = clampLaborBlueprintCoordinate(point.y - laborBlueprintDrag.offsetY);
        resizeLaborBlueprintWorld(record.robot.supportBlueprint.nodes);
        const element = laborBlueprintNodeElement(node.id);
        if (element) {
          element.style.left = `${node.x}px`;
          element.style.top = `${node.y}px`;
        }
        renderLaborBlueprintWires();
      }
      event.preventDefault();
      return true;
    }

    if (laborBlueprintPan?.pointerId === event.pointerId) {
      laborBlueprintView.x = laborBlueprintPan.viewX + event.clientX - laborBlueprintPan.startX;
      laborBlueprintView.y = laborBlueprintPan.viewY + event.clientY - laborBlueprintPan.startY;
      applyLaborBlueprintView();
      renderLaborBlueprintWires();
      event.preventDefault();
      return true;
    }
    return true;
  }

  function finishLaborBlueprintPointer(event, cancelled = false) {
    if (laborPaletteDrag?.pointerId === event.pointerId) return finishLaborPaletteDrag(event, cancelled);
    if (!laborBlueprintPointers.has(event.pointerId)) return false;
    const editor = document.getElementById("labor-blueprint-editor");
    const wireDrag = laborBlueprintWireDrag?.pointerId === event.pointerId ? laborBlueprintWireDrag : null;
    const nodeDrag = laborBlueprintDrag?.pointerId === event.pointerId ? laborBlueprintDrag : null;

    if (wireDrag && !cancelled) {
      const input = matchingLaborBlueprintInputAt(event.clientX, event.clientY, wireDrag);
      laborBlueprintWireDrag = null;
      if (input) {
        connectSupportBlueprintPins(
          wireDrag.fromId,
          wireDrag.fromPin,
          input.dataset.blueprintNode,
          input.dataset.blueprintPinId
        );
      } else {
        renderLaborBlueprintWires();
      }
    } else if (wireDrag) {
      laborBlueprintWireDrag = null;
      renderLaborBlueprintWires();
    }

    if (nodeDrag) {
      laborBlueprintDrag = null;
      if (!cancelled) {
        const record = selectedLaborRobotRecord();
        if (record) resetLaborRobotBlueprintRuntime(record.robot);
        saveGame();
        renderLaborBlueprint();
      }
    }
    if (laborBlueprintPan?.pointerId === event.pointerId) laborBlueprintPan = null;

    laborBlueprintPointers.delete(event.pointerId);
    if (laborBlueprintPointers.size < 2) laborBlueprintPinch = null;
    clearLaborBlueprintPinTargets();
    if (!laborBlueprintPointers.size) editor?.classList.remove("dragging", "panning");
    try {
      editor?.releasePointerCapture(event.pointerId);
    } catch {
    }
    event.preventDefault();
    return true;
  }
  function handleLaborBlueprintPointerUp(event) {
    return finishLaborBlueprintPointer(event, false);
  }

  function handleLaborBlueprintPointerCancel(event) {
    return finishLaborBlueprintPointer(event, true);
  }

  function handleLaborBlueprintWheel(event) {
    if (!event.target.closest?.("#labor-blueprint-editor")) return false;
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    zoomLaborBlueprintAt(event.clientX, event.clientY, laborBlueprintView.zoom * factor);
    event.preventDefault();
    return true;
  }

  function consumeLaborEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  applyLaborStaticTooltips();
  updateLaborTooltipToggleControl();
  ensureLaborTooltip();

  document.addEventListener("click", (event) => {
    const valueStepButton = event.target.closest?.("[data-blueprint-value-delta]");
    if (valueStepButton) {
      const record = selectedLaborRobotRecord();
      const nodeId = valueStepButton.dataset.blueprintNode;
      const node = supportBlueprintNodeById(record?.robot.supportBlueprint, nodeId);
      const delta = Number(valueStepButton.dataset.blueprintValueDelta);
      if (record && node && Number.isFinite(delta)) {
        const valueInput = valueStepButton.closest(".blueprint-value-control")
          ?.querySelector('input[data-blueprint-arg="value"]');
        const currentValue = Number(valueInput?.value);
        const nextValue = Math.max(0, Math.min(999999,
          (Number.isFinite(currentValue) ? currentValue : Number(node.value) || 0) + delta
        ));
        updateSupportBlueprintNodeArg(nodeId, "value", String(nextValue));
      }
      consumeLaborEvent(event);
      return;
    }
    const packageAddButton = event.target.closest?.("[data-blueprint-package-add]");
    if (packageAddButton) {
      if (Date.now() < laborPaletteSuppressClickUntil) {
        consumeLaborEvent(event);
        return;
      }
      addLaborBlueprintPackage(packageAddButton.dataset.blueprintPackageAdd);
      consumeLaborEvent(event);
      return;
    }
    const paletteGroupButton = event.target.closest?.("[data-blueprint-palette-group]");
    if (paletteGroupButton) {
      laborBlueprintPaletteGroup = paletteGroupButton.dataset.blueprintPaletteGroup || "TASK";
      renderLaborBlueprint();
      consumeLaborEvent(event);
      return;
    }
    const robotButton = event.target.closest?.("[data-labor-robot]");
    if (robotButton) {
      selectedLaborRobotId = robotButton.dataset.laborRobot;
      laborBlueprintView = { x: 34, y: 34, zoom: 1 };
      renderLabor();
      requestAnimationFrame(centerLaborBlueprintView);
      consumeLaborEvent(event);
      return;
    }
    const addButton = event.target.closest?.("[data-blueprint-add]");
    if (addButton) {
      if (Date.now() < laborPaletteSuppressClickUntil) {
        consumeLaborEvent(event);
        return;
      }
      addSupportBlueprintNode(addButton.dataset.blueprintAdd);
      consumeLaborEvent(event);
      return;
    }
    const deleteButton = event.target.closest?.("[data-blueprint-delete]");
    if (deleteButton) {
      removeSupportBlueprintNode(deleteButton.dataset.blueprintDelete);
      consumeLaborEvent(event);
      return;
    }
    if (event.target.closest?.("[data-blueprint-center]")) {
      centerLaborBlueprintView();
      consumeLaborEvent(event);
      return;
    }
  });

  document.addEventListener("input", (event) => {
    const packsInput = event.target.closest?.('input[data-blueprint-arg="packs"]');
    if (packsInput) {
      const record = selectedLaborRobotRecord();
      const node = supportBlueprintNodeById(record?.robot.supportBlueprint, packsInput.dataset.blueprintNode);
      const cropId = CROPS[node?.cropId] ? node.cropId : "lettuce";
      const packs = Math.max(1, Math.min(12, Math.floor(Number(packsInput.value) || 1)));
      const price = currentSeedPrice(cropId);
      const total = packsInput.closest(".blueprint-node-args")?.querySelector(".blueprint-market-readout strong");
      if (total) total.textContent = "₡" + formatNumber(price) + " / TOTAL ₡" + formatNumber(price * packs);
      if (record && node) {
        node.packs = packs;
        resetLaborRobotBlueprintRuntime(record.robot);
        saveGame();
      }
      return;
    }
    const nameInput = event.target.closest?.("[data-labor-name]");
    if (!nameInput) return;
    const roster = supportRobotRoster();
    const recordIndex = roster.findIndex(({ robot }) => robot.id === nameInput.dataset.laborName);
    const record = roster[recordIndex];
    if (!record || record.robot.isInitialSupportRobot) return;
    const fallback = `SR-${String(recordIndex + 1).padStart(2, "0")}`;
    record.robot.robotName = String(nameInput.value || "").trim().slice(0, 24) || fallback;
    const card = [...document.querySelectorAll("[data-labor-robot]")]
      .find((element) => element.dataset.laborRobot === record.robot.id);
    const cardName = card?.querySelector("strong");
    if (cardName) cardName.textContent = record.robot.robotName;
    const label = document.getElementById("blueprint-robot-label");
    if (label && record.robot.id === selectedLaborRobotId) {
      label.textContent = `${record.robot.robotName} // ${supportRobotLocationLabel(record.base, record.robot)}`;
    }
    saveGame();
  });

  document.addEventListener("focusin", (event) => {
    const tooltipTarget = laborTooltipTargetFromEvent(event);
    if (tooltipTarget) showLaborTooltip(tooltipTarget);
    const valueInput = event.target.closest?.('input[data-blueprint-arg="value"]');
    if (valueInput) requestAnimationFrame(() => valueInput.select());
  }, true);

  document.addEventListener("focusout", () => {
    window.setTimeout(() => {
      const activeTarget = document.activeElement?.closest?.("[data-labor-tooltip]");
      if (!activeTarget?.closest?.("#labor-screen")) hideLaborTooltip();
    }, 0);
  }, true);

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen" || laborTooltipPinned) return;
    const tooltipTarget = laborTooltipTargetFromEvent(event);
    if (tooltipTarget) showLaborTooltip(tooltipTarget);
  }, true);

  document.addEventListener("pointerout", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen" || laborTooltipPinned) return;
    const tooltipTarget = laborTooltipTargetFromEvent(event);
    if (!tooltipTarget) return;
    const nextTarget = event.relatedTarget?.closest?.("[data-labor-tooltip]");
    if (nextTarget?.closest?.("#labor-screen")) {
      showLaborTooltip(nextTarget);
    } else {
      hideLaborTooltip();
    }
  }, true);

  document.addEventListener("change", (event) => {
    const tooltipToggle = event.target.closest?.("[data-labor-tooltip-toggle]");
    if (tooltipToggle) {
      setLaborTooltipsEnabled(tooltipToggle.checked);
      event.stopImmediatePropagation();
      return;
    }
    const nameInput = event.target.closest?.("[data-labor-name]");
    if (nameInput) {
      const roster = supportRobotRoster();
      const recordIndex = roster.findIndex(({ robot }) => robot.id === nameInput.dataset.laborName);
      const record = roster[recordIndex];
      if (record && !record.robot.isInitialSupportRobot) {
        const fallback = `SR-${String(recordIndex + 1).padStart(2, "0")}`;
        record.robot.robotName = String(nameInput.value || "").trim().slice(0, 24) || fallback;
        saveGame();
        renderLabor();
      }
      event.stopImmediatePropagation();
      return;
    }
    const argInput = event.target.closest?.("[data-blueprint-arg]");
    if (argInput) {
      updateSupportBlueprintNodeArg(
        argInput.dataset.blueprintNode,
        argInput.dataset.blueprintArg,
        argInput.value
      );
      event.stopImmediatePropagation();
    }
  });
  document.addEventListener("pointerdown", handleLaborTooltipPointerDown, true);
  document.addEventListener("pointermove", handleLaborTooltipPointerMove, true);
  document.addEventListener("pointerup", finishLaborTooltipPointer, true);
  document.addEventListener("pointercancel", (event) => {
    finishLaborTooltipPointer(event, true);
  }, true);


  document.addEventListener("pointerdown", (event) => {
    if (handleLaborBlueprintPointerDown(event)) event.stopImmediatePropagation();
  });
  document.addEventListener("pointermove", (event) => {
    if (handleLaborBlueprintPointerMove(event)) event.stopImmediatePropagation();
  });
  document.addEventListener("pointerup", (event) => {
    if (handleLaborBlueprintPointerUp(event)) event.stopImmediatePropagation();
  });
  document.addEventListener("pointercancel", (event) => {
    if (handleLaborBlueprintPointerCancel(event)) event.stopImmediatePropagation();
  });
  document.addEventListener("wheel", (event) => {
    if (handleLaborBlueprintWheel(event)) event.stopImmediatePropagation();
  }, { passive: false });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideLaborTooltip(true);
  });
  document.addEventListener("scroll", () => {
    if (laborTooltipTarget) positionLaborTooltip();
  }, { capture: true, passive: true });
  window.addEventListener("resize", () => {
    if (laborTooltipTarget) positionLaborTooltip();
  });
  window.addEventListener("blur", () => {
    clearLaborBlueprintInteraction();
    hideLaborTooltip(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearLaborBlueprintInteraction();
      hideLaborTooltip(true);
    }
  });

  window.configureLaborTooltips = configureLaborTooltips;
  window.renderLabor = renderLabor;
  window.renderLaborBlueprint = renderLaborBlueprint;
  window.renderLaborBlueprintWires = renderLaborBlueprintWires;
  window.updateLaborRobotVitals = updateLaborRobotVitals;
  window.updateLaborBlueprintRuntime = updateLaborBlueprintRuntime;
  window.supportBlueprintNodeUnlockState = supportBlueprintNodeUnlockState;
  window.connectSupportBlueprintPins = connectSupportBlueprintPins;
  window.clearLaborBlueprintInteraction = clearLaborBlueprintInteraction;
})();