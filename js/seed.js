/* 内置字卡与初始状态（原创文案） */
(function () {
  const App = (window.App = window.App || {});

  App.CATEGORIES = ['聊天', '拍一拍', '情绪', '语音'];

  /* 默认头像：灰底人物剪影 */
  App.DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
      '<rect width="96" height="96" fill="#e8eaee"/>' +
      '<circle cx="48" cy="37" r="16" fill="#c2c6cd"/>' +
      '<path d="M16 96c0-17.7 14.3-32 32-32s32 14.3 32 32z" fill="#c2c6cd"/>' +
    '</svg>'
  );

  /* 聊天：普通回复，可用于聊天、朋友圈等地 */
  const CHAT_RAW = [
    ['今天路过一家面包店，闻到黄油味就想起你了。', ''],
    ['刚睡醒，头发乱得像被风揉过。你呢？', ''],
    ['中午吃了碗热汤面，胃里暖了很久。', ''],
    ['窗外的云走得很慢，我也没什么急事。', ''],
    ['刚洗完衣服，阳台上一排小旗子。', ''],
    ['今天的风有点甜，可能是路过花店沾上的。', ''],
    ['在地铁上看到一只很乖的橘猫，可惜没拍清。', '猫'],
    ['刚泡了杯茶，热气把眼镜糊住了。', ''],
    ['你今天有没有想我，老实回答。', '想你'],
    ['我不管，反正你要先理我。', ''],
    ['分你一半耳机，歌单不许嫌弃。', ''],
    ['想被你揉揉脑袋，就一下。', ''],
    ['我在你旁边坐一会儿，不说话也行。', ''],
    ['你今天夸我一句，我就乖一整天。', ''],
    ['记得吃饭，别又拿咖啡当午饭。', '吃饭'],
    ['如果累了就早点睡，消息可以明天回。', '累'],
    ['天凉了，出门加件外套。', '冷'],
    ['喝水了吗？现在，立刻，一口。', ''],
    ['别总皱着眉，事情一件一件来。', ''],
    ['到家跟我说一声，我等你。', '到家'],
    ['你这句话敷衍得像复制粘贴的。', ''],
    ['行吧，你赢了，但我不服。', ''],
    ['我又没生气，我只是在组织语言。', '生气'],
    ['你这个表情，我截图存证了。', ''],
    ['再说一遍？我假装没听见。', ''],
    ['好好好，你说的都对（小声）。', ''],
    ['夜深了，把手机亮度调低一点。', ''],
    ['睡不着的话，我们随便聊点什么。', '失眠'],
    ['今天的月亮很淡，像被水洗过。', ''],
    ['晚安，梦里要是遇见我，记得打招呼。', '晚安'],
    ['我把今天最后一句留给你。', ''],
    ['别熬太晚，明天还要好好生活。', '熬夜'],
    ['你已经做得很好了，真的。', ''],
    ['慢一点也没关系，路不会跑。', ''],
    ['这次没成，下次换个方式再来。', '失败'],
    ['你身上有很多你自己没看见的好。', ''],
    ['先深呼吸，然后把最小的一件事做完。', ''],
    ['我在，不用一个人扛。', '难过'],
  ];

  /* 情绪：带情绪标签，会在气泡下方展示 */
  const EMOTION_RAW = [
    ['不辛苦', '高兴', '强'],
    ['谢谢你一直记得', '感动', '强'],
    ['见到你就开心', '高兴', '强'],
    ['我在呢', '安心', '强'],
    ['有点小委屈', '委屈', '中'],
    ['今天有点累', '疲惫', '中'],
    ['想一个人待一会儿', '低落', '弱'],
    ['晚安，明天见', '平静', '弱'],
  ];

  /* 拍一拍：只在聊天里点“拍一拍”时出现，{name} 会被替换 */
  const PAT_RAW = [
    '拍了拍{name}的头',
    '轻轻戳了戳{name}的脸',
    '拍了拍{name}的肩膀',
    '揉了揉{name}的头发',
    '朝{name}挥了挥手',
    '碰了碰{name}的手背',
  ];

  App.BUILTIN_CARDS = [];

  CHAT_RAW.forEach(function (row, i) {
    App.BUILTIN_CARDS.push({
      id: 'builtin-chat-' + i,
      category: '聊天',
      text: row[0],
      trigger: row[1],
      enabled: true,
      builtin: true,
    });
  });

  PAT_RAW.forEach(function (text, i) {
    App.BUILTIN_CARDS.push({
      id: 'builtin-pat-' + i,
      category: '拍一拍',
      text: text,
      trigger: '',
      enabled: true,
      builtin: true,
    });
  });

  EMOTION_RAW.forEach(function (row, i) {
    App.BUILTIN_CARDS.push({
      id: 'builtin-emotion-' + i,
      category: '情绪',
      text: row[0],
      emotion: row[1],
      trigger: '',
      enabled: true,
      builtin: true,
    });
  });



  App.DEFAULT_STICKERS = { mine: [], ta: [], public: [] };

  App.MUSIC_SEED = function () {
    return {
      currentId: '',
      mode: 'sequence',
      favorites: { mine: [], ta: [] },
      tracks: [],
    };
  };

  function localDate(date) {
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  App.seedState = function () {
    const d = new Date();
    d.setDate(d.getDate() - 128);
    const contactId = 'c-amian';
    return {
      version: 1,
      theme: 'mist',
      notes: '',
      iconStyle: { shape: 'rounded', color: 'blue' },
      anniversaries: [],
      reminders: [],
      look: { bgImage: '', chatBg: '', callBg: '', bubbleCss: '', opacity: 80 },
      music: App.MUSIC_SEED(),
      profile: {
        userName: '我',
        userAvatar: App.DEFAULT_AVATAR,
        since: localDate(d),
      },
      settings: {
        replyMin: 1,
        replyMax: 2,
        typingMin: 0.1,
        taMsgProb: 8,
        taIgnoreProb: 15,
        emotionProb: 30,
        taLikeProb: 60,
        taCommentProb: 40,
        taMomentCards: 1,
        taMomentProb: 25,
        taMomentDailyMax: 3,
        taMomentGapMin: 10,
        taMomentGapMax: 60,
        taMomentCardMin: 1,
        taMomentCardMax: 3,
        taRecallProb: 5,
        taQuoteProb: 20,
        taFavProb: 15,
        musicPauseProb: 15,
        musicPlayProb: 60,
        musicFavProb: 25,
        musicSwitchProb: 30,
      },
      contacts: [
        { id: contactId, name: 'ta', avatar: App.DEFAULT_AVATAR, note: '住在隔壁的夜猫子', birthday: '' },
      ],
      avatarPool: { mine: [], ta: [] },
      chats: {
        [contactId]: [
          { id: 'm-welcome', role: 'ta', text: '你来啦。今天过得怎么样？', ts: Date.now() },
        ],
      },
      cards: App.BUILTIN_CARDS.map(function (c) { return Object.assign({}, c); }),
      stickers: App.DEFAULT_STICKERS,
      wallet: App.WALLET_SEED(),
      market: { products: App.MARKET_SEED() },
    };
  };

  /* 同心币钱包与集市默认商品 */
  App.WALLET_SEED = function () {
    return { me: 520, ta: 520 };
  };

  App.MARKET_SEED = function () {
    return [
      { id: 'p-moon', name: '月亮抱枕', price: 120, icon: '🌙', fav: { me: false, ta: false } },
      { id: 'p-cocoa', name: '深夜热可可', price: 48, icon: '☕️', fav: { me: false, ta: false } },
      /* 日常用品 */
      { id: 'p-tissue', name: '抽纸', price: 9, icon: '🧻', fav: { me: false, ta: false } },
      { id: 'p-toothbrush', name: '软毛牙刷', price: 15, icon: '🪥', fav: { me: false, ta: false } },
      { id: 'p-towel', name: '纯棉毛巾', price: 25, icon: '🧺', fav: { me: false, ta: false } },
      { id: 'p-laundry', name: '洗衣液', price: 32, icon: '🧴', fav: { me: false, ta: false } },
      { id: 'p-umbrella', name: '折叠雨伞', price: 45, icon: '☂️', fav: { me: false, ta: false } },
      { id: 'p-thermos', name: '保温杯', price: 65, icon: '🫗', fav: { me: false, ta: false } },
      { id: 'p-slippers', name: '毛绒拖鞋', price: 39, icon: '🩴', fav: { me: false, ta: false } },
      { id: 'p-lamp', name: '小夜灯', price: 59, icon: '💡', fav: { me: false, ta: false } },
      { id: 'p-storage', name: '收纳盒', price: 29, icon: '📦', fav: { me: false, ta: false } },
      { id: 'p-candle', name: '香薰蜡烛', price: 68, icon: '🕯️', fav: { me: false, ta: false } },
      { id: 'p-cable', name: '数据线', price: 19, icon: '🔌', fav: { me: false, ta: false } },
      { id: 'p-pillow', name: '云朵抱枕', price: 89, icon: '☁️', fav: { me: false, ta: false } },
      { id: 'p-eyemask', name: '真丝眼罩', price: 35, icon: '😴', fav: { me: false, ta: false } },
      { id: 'p-earplug', name: '隔音耳塞', price: 22, icon: '🎧', fav: { me: false, ta: false } },
      { id: 'p-notebook', name: '手账本', price: 26, icon: '📓', fav: { me: false, ta: false } },
      { id: 'p-pen', name: '中性笔', price: 6, icon: '🖊️', fav: { me: false, ta: false } },
      { id: 'p-mug', name: '马克杯', price: 42, icon: '☕', fav: { me: false, ta: false } },
      { id: 'p-socks', name: '棉袜', price: 12, icon: '🧦', fav: { me: false, ta: false } },
      { id: 'p-mask', name: '面膜', price: 30, icon: '🧖‍♀️', fav: { me: false, ta: false } },
      { id: 'p-mirror', name: '随身小镜子', price: 18, icon: '🪞', fav: { me: false, ta: false } },
      { id: 'p-hairclip', name: '发夹', price: 8, icon: '🎀', fav: { me: false, ta: false } },
      { id: 'p-tape', name: '手账胶带', price: 10, icon: '🧷', fav: { me: false, ta: false } },
      { id: 'p-sponge', name: '洗碗海绵', price: 5, icon: '🧽', fav: { me: false, ta: false } },
      { id: 'p-detergent', name: '洗洁精', price: 14, icon: '🫧', fav: { me: false, ta: false } },
      { id: 'p-tissuebox', name: '纸巾盒', price: 20, icon: '🗃️', fav: { me: false, ta: false } },
      { id: 'p-hanger', name: '衣架', price: 7, icon: '🪝', fav: { me: false, ta: false } },
      { id: 'p-clock', name: '小闹钟', price: 55, icon: '⏰', fav: { me: false, ta: false } },
      { id: 'p-plant', name: '多肉盆栽', price: 36, icon: '🪴', fav: { me: false, ta: false } },
      { id: 'p-thermometer', name: '体温计', price: 28, icon: '🌡️', fav: { me: false, ta: false } },
      { id: 'p-bandage', name: '创可贴', price: 6, icon: '🩹', fav: { me: false, ta: false } },
      /* 小吃 */
      { id: 'p-latiao', name: '辣条', price: 5, icon: '🌶️', fav: { me: false, ta: false } },
      { id: 'p-chips', name: '薯片', price: 8, icon: '🍟', fav: { me: false, ta: false } },
      { id: 'p-popcorn', name: '焦糖爆米花', price: 12, icon: '🍿', fav: { me: false, ta: false } },
      { id: 'p-sausage', name: '烤肠', price: 6, icon: '🌭', fav: { me: false, ta: false } },
      { id: 'p-oden', name: '关东煮', price: 14, icon: '🍢', fav: { me: false, ta: false } },
      { id: 'p-noodle', name: '泡面', price: 7, icon: '🍜', fav: { me: false, ta: false } },
      { id: 'p-beefjerky', name: '牛肉干', price: 26, icon: '🥩', fav: { me: false, ta: false } },
      { id: 'p-seeds', name: '焦糖瓜子', price: 9, icon: '🌻', fav: { me: false, ta: false } },
      { id: 'p-nuts', name: '每日坚果', price: 22, icon: '🥜', fav: { me: false, ta: false } },
      { id: 'p-jelly', name: '果冻', price: 6, icon: '🍬', fav: { me: false, ta: false } },
      { id: 'p-biscuit', name: '曲奇饼干', price: 15, icon: '🍪', fav: { me: false, ta: false } },
      { id: 'p-seaweed', name: '海苔', price: 8, icon: '🌿', fav: { me: false, ta: false } },
      { id: 'p-duckneck', name: '鸭脖', price: 18, icon: '🦆', fav: { me: false, ta: false } },
      { id: 'p-corn', name: '奶油玉米', price: 7, icon: '🌽', fav: { me: false, ta: false } },
      { id: 'p-teaegg', name: '茶叶蛋', price: 4, icon: '🥚', fav: { me: false, ta: false } },
      { id: 'p-sweetpotato', name: '烤红薯', price: 8, icon: '🍠', fav: { me: false, ta: false } },
      { id: 'p-skewer', name: '小串串', price: 12, icon: '🍡', fav: { me: false, ta: false } },
      { id: 'p-friedchicken', name: '炸鸡', price: 25, icon: '🍗', fav: { me: false, ta: false } },
      /* 甜品 */
      { id: 'p-cake', name: '草莓小蛋糕', price: 38, icon: '🍰', fav: { me: false, ta: false } },
      { id: 'p-eggtart', name: '葡式蛋挞', price: 10, icon: '🥧', fav: { me: false, ta: false } },
      { id: 'p-pudding', name: '焦糖布丁', price: 12, icon: '🍮', fav: { me: false, ta: false } },
      { id: 'p-macaron', name: '马卡龙', price: 21, icon: '🧁', fav: { me: false, ta: false } },
      { id: 'p-icecream', name: '冰淇淋', price: 9, icon: '🍦', fav: { me: false, ta: false } },
      { id: 'p-tiramisu', name: '提拉米苏', price: 32, icon: '🫘', fav: { me: false, ta: false } },
      { id: 'p-donut', name: '甜甜圈', price: 11, icon: '🍩', fav: { me: false, ta: false } },
      { id: 'p-croissant', name: '黄油可颂', price: 13, icon: '🥐', fav: { me: false, ta: false } },
      { id: 'p-mochi', name: '雪媚娘', price: 16, icon: '🥟', fav: { me: false, ta: false } },
      { id: 'p-creampuff', name: '奶油泡芙', price: 14, icon: '🥯', fav: { me: false, ta: false } },
      { id: 'p-chocolate', name: '手工巧克力', price: 28, icon: '🍫', fav: { me: false, ta: false } },
      { id: 'p-cookies', name: '蔓越莓曲奇', price: 17, icon: '🍪', fav: { me: false, ta: false } },
      { id: 'p-pancake', name: '舒芙蕾松饼', price: 24, icon: '🥞', fav: { me: false, ta: false } },
      /* 饮品与水果 */
      { id: 'p-milktea', name: '珍珠奶茶', price: 16, icon: '🧋', fav: { me: false, ta: false } },
      { id: 'p-latte', name: '燕麦拿铁', price: 20, icon: '☕️', fav: { me: false, ta: false } },
      { id: 'p-lemontea', name: '手打柠檬茶', price: 14, icon: '🍋', fav: { me: false, ta: false } },
      { id: 'p-soda', name: '气泡水', price: 7, icon: '🥤', fav: { me: false, ta: false } },
      { id: 'p-soymilk', name: '热豆浆', price: 5, icon: '🥛', fav: { me: false, ta: false } },
      { id: 'p-strawberry', name: '奶油草莓', price: 36, icon: '🍓', fav: { me: false, ta: false } },
      { id: 'p-cherry', name: '车厘子', price: 68, icon: '🍒', fav: { me: false, ta: false } },
      { id: 'p-mango', name: '芒果', price: 22, icon: '🥭', fav: { me: false, ta: false } },
      { id: 'p-watermelon', name: '冰镇西瓜', price: 18, icon: '🍉', fav: { me: false, ta: false } },
    ];
  };
})();
