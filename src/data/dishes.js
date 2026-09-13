/**
 * 菜品数据库
 * ---------------------------------------------------------------
 * 每一道菜都有一套元数据 + 一个 id；id 会在
 * `src/three/models/index.js` 里被映射到程序化 3D 模型工厂。
 * 这里不引入任何外部图片 / 模型资源。
 */

export const CATEGORIES = [
  { id: 'all', name: '全部', accent: 0xffb347 },
  { id: 'mine', name: '我的', accent: 0x9d8cff, custom: true },
  { id: 'chinese', name: '中餐', accent: 0xff7043 },
  { id: 'japanese', name: '日料', accent: 0x6fb8ff },
  { id: 'western', name: '西餐', accent: 0xc08bff },
  { id: 'fastfood', name: '快餐', accent: 0xffd36e },
  { id: 'dessert', name: '甜品', accent: 0xff8fc4 },
  { id: 'veggie', name: '素食', accent: 0x7ee2b8 },
];

/** 加菜表单里能选的分类（不含「全部」和「我的」） */
export const PICKABLE_CATEGORIES = CATEGORIES.filter(
  (c) => c.id !== 'all' && c.id !== 'mine',
);

export const CATEGORY_NAME = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));

/** 辣度 → 展示文案 */
const SPICY_LABEL = ['不辣', '微辣', '中辣', '特辣'];

/**
 * @typedef {Object} Dish
 * @property {string} id        与 3D 模型工厂同名
 * @property {string} name      中文菜名
 * @property {string} emoji     用于 DOM 的金句图标
 * @property {string} category  分类 id
 * @property {string} desc      一句话介绍（出现在结果卡片）
 * @property {string} tip       结果卡片底下的小贴士
 * @property {number} kcal      热量（千卡）
 * @property {number} price     人均价格（元）
 * @property {number} spicy     辣度 0-3
 * @property {string[]} tags    标签
 * @property {number} accent    主题色（0xRRGGBB）
 */

/** @type {Dish[]} */
export const DISHES = [
  /* ---------------- 中餐 ---------------- */
  {
    id: 'hotpot',
    name: '麻辣牛油火锅',
    emoji: '🍲',
    category: 'chinese',
    desc: '红汤翻滚，牛油香气先撞到脸上。毛肚七上八下，鸭血嫩得发抖。',
    tip: '建议三到四人一起，一个人吃火锅容易被服务员同情。',
    kcal: 1120,
    price: 128,
    spicy: 3,
    tags: ['聚餐首选', '冬天', '重口'],
    accent: 0xff4d2e,
  },
  {
    id: 'dumplings',
    name: '猪肉白菜饺子',
    emoji: '🥟',
    category: 'chinese',
    desc: '薄皮大馅，咬开一个小口先喝汤。蘸醋加蒜，二十个起步。',
    tip: '配一碗饺子汤，原汤化原食。',
    kcal: 520,
    price: 38,
    spicy: 0,
    tags: ['家常', '踏实', '暖'],
    accent: 0xf3e3c8,
  },
  {
    id: 'bbq',
    name: '炭火烧烤串',
    emoji: '🍢',
    category: 'chinese',
    desc: '孜然和辣椒面在炭火上炸开，油脂滴下去冒起一小股白烟。',
    tip: '先点十串羊肉，再决定要不要放纵。',
    kcal: 780,
    price: 88,
    spicy: 2,
    tags: ['夜宵', '啤酒搭子', '烟火气'],
    accent: 0xff8a3d,
  },

  /* ---------------- 日料 ---------------- */
  {
    id: 'ramen',
    name: '豚骨拉面',
    emoji: '🍜',
    category: 'japanese',
    desc: '乳白汤底熬足十二小时，溏心蛋一戳就流，叉烧边缘微焦。',
    tip: '汤要趁热喝，凉了会腻。',
    kcal: 620,
    price: 46,
    spicy: 1,
    tags: ['一人食', '热汤', '治愈'],
    accent: 0xffc266,
  },
  {
    id: 'sushi',
    name: '握寿司拼盘',
    emoji: '🍣',
    category: 'japanese',
    desc: '醋饭微温，鱼生带着海水的凉。一口一个，节奏感很好。',
    tip: '别把芥末拌进酱油里，师傅会心疼。',
    kcal: 430,
    price: 98,
    spicy: 0,
    tags: ['清爽', '仪式感', '低负担'],
    accent: 0xff7a6b,
  },
  {
    id: 'curry',
    name: '咖喱猪排饭',
    emoji: '🍛',
    category: 'japanese',
    desc: '厚切猪排炸到金黄，咖喱里能吃到苹果和蜂蜜的甜。',
    tip: '把猪排留到最后一块，仪式感翻倍。',
    kcal: 860,
    price: 52,
    spicy: 1,
    tags: ['碳水快乐', '满足', '学生党'],
    accent: 0xffa63d,
  },

  /* ---------------- 西餐 ---------------- */
  {
    id: 'steak',
    name: '黑椒肋眼牛排',
    emoji: '🥩',
    category: 'western',
    desc: '三分熟，切开断面还是粉的。黑椒汁浇下去，铁板滋啦一声。',
    tip: '静置三分钟再切，肉汁才不会跑。',
    kcal: 720,
    price: 168,
    spicy: 0,
    tags: ['约会', '大口吃肉', '贵但值'],
    accent: 0xd2533a,
  },
  {
    id: 'pizza',
    name: '玛格丽特披萨',
    emoji: '🍕',
    category: 'western',
    desc: '番茄、罗勒、马苏里拉，简单三样。拉丝能拉出一条手臂长。',
    tip: '一定要趁热，芝士凉了就是橡皮。',
    kcal: 900,
    price: 76,
    spicy: 0,
    tags: ['分享', '拉丝', '碳水'],
    accent: 0xff6f4a,
  },
  {
    id: 'pasta',
    name: '奶油培根意面',
    emoji: '🍝',
    category: 'western',
    desc: '酱汁裹住每一根面，培根煎出脆边，撒一把现磨黑胡椒。',
    tip: '配一杯气泡水，解腻。',
    kcal: 740,
    price: 62,
    spicy: 0,
    tags: ['浓郁', '顺滑', '碳水'],
    accent: 0xf6d38a,
  },

  /* ---------------- 快餐 ---------------- */
  {
    id: 'burger',
    name: '双层芝士汉堡',
    emoji: '🍔',
    category: 'fastfood',
    desc: '两片牛肉饼，芝士融化后顺着边缘往下爬，面包胚还是温的。',
    tip: '双手压扁再吃，这才是正确姿势。',
    kcal: 680,
    price: 32,
    spicy: 0,
    tags: ['快', '罪恶', '十分钟解决'],
    accent: 0xffa43d,
  },
  {
    id: 'friedchicken',
    name: '脆皮炸鸡桶',
    emoji: '🍗',
    category: 'fastfood',
    desc: '外壳咬下去有声音，里面还是滚烫的汁。配可乐，人生圆满。',
    tip: '拿最上面那块，通常最大。',
    kcal: 950,
    price: 69,
    spicy: 1,
    tags: ['分享', '快乐', '放纵'],
    accent: 0xff9436,
  },
  {
    id: 'fries',
    name: '黄金薯条',
    emoji: '🍟',
    category: 'fastfood',
    desc: '刚出锅的，外脆内沙，撒盐的那一刻最香。',
    tip: '趁热吃，超过五分钟就开始变得平庸。',
    kcal: 380,
    price: 18,
    spicy: 0,
    tags: ['便宜', '配菜', '上瘾'],
    accent: 0xffd05e,
  },

  /* ---------------- 甜品 ---------------- */
  {
    id: 'milktea',
    name: '珍珠奶茶',
    emoji: '🧋',
    category: 'dessert',
    desc: '三分糖去冰，珍珠 Q 弹。吸管插下去那一声「啵」很解压。',
    tip: '下午三点喝，正好撑到晚饭。',
    kcal: 420,
    price: 20,
    spicy: 0,
    tags: ['续命', '甜', '随时'],
    accent: 0xd9a06a,
  },
  {
    id: 'icecream',
    name: '草莓冰淇淋圣代',
    emoji: '🍨',
    category: 'dessert',
    desc: '两球冰淇淋顶着一颗红樱桃，淋上草莓酱，盘底还在冒冷气。',
    tip: '先吃樱桃的人，运气都不会太差。',
    kcal: 330,
    price: 24,
    spicy: 0,
    tags: ['凉', '少女心', '拍照好看'],
    accent: 0xff9ec7,
  },
  {
    id: 'cake',
    name: '草莓奶油蛋糕',
    emoji: '🍰',
    category: 'dessert',
    desc: '戚风软得像云，奶油不甜不腻，中间藏着整颗草莓。',
    tip: '配红茶，不要配咖啡，会抢味。',
    kcal: 460,
    price: 36,
    spicy: 0,
    tags: ['下午茶', '甜', '仪式感'],
    accent: 0xffb3c6,
  },

  /* ---------------- 素食 ---------------- */
  {
    id: 'salad',
    name: '牛油果藜麦沙拉',
    emoji: '🥗',
    category: 'veggie',
    desc: '牛油果、藜麦、小番茄、烤南瓜，油醋汁一拌，绿得发光。',
    tip: '加一颗溏心蛋，饱腹感能翻倍。',
    kcal: 320,
    price: 45,
    spicy: 0,
    tags: ['轻食', '低卡', '打工人午餐'],
    accent: 0x8fd96a,
  },
  {
    id: 'roastedveg',
    name: '烤时蔬拼盘',
    emoji: '🥦',
    category: 'veggie',
    desc: '西兰花、彩椒、口蘑、玉米，烤到边缘微焦，撒海盐和黑胡椒。',
    tip: '挤半个柠檬，整盘会醒过来。',
    kcal: 280,
    price: 39,
    spicy: 0,
    tags: ['轻食', '清爽', '零负担'],
    accent: 0x9ee08a,
  },
  {
    id: 'tofusoup',
    name: '菌菇豆腐煲',
    emoji: '🍄',
    category: 'veggie',
    desc: '砂锅端上桌还在咕嘟，嫩豆腐吸满菌菇汤，一勺下去全是鲜。',
    tip: '小心烫，先吹三口。',
    kcal: 310,
    price: 42,
    spicy: 1,
    tags: ['热汤', '暖', '舒服'],
    accent: 0xc9a97a,
  },
];

export const DISH_BY_ID = Object.fromEntries(DISHES.map((d) => [d.id, d]));

export function spicyLabel(level) {
  return SPICY_LABEL[Math.max(0, Math.min(3, level | 0))];
}

/** 分类主题色 → CSS hex */
export function hexCss(hex) {
  return '#' + (hex >>> 0).toString(16).padStart(6, '0');
}
