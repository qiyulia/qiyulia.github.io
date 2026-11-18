/* 内置字卡与初始状态（原创文案） */
(function () {
  const App = (window.App = window.App || {});

  App.CATEGORIES = ['聊天', '拍一拍', '情绪', '语音', '修罗场', '追加', '默契问答', '地点'];

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

  /* 修罗场：在聊天里提到其他联系人名字时，TA 的吃醋回复 */
  const JEALOUS_RAW = [
    '你刚才叫的是谁的名字？',
    'TA 是谁？我认识吗？',
    '当着我的面提别人，嗯？',
    '我吃醋了，哄我，就现在。',
    '你和 TA 是什么关系，从实招来。',
    '名字我都听见了，解释一下。',
    '哼，你去找 TA 好了。',
    '再说一遍，你刚刚想跟谁说这句话？',
  ];

  App.BUILTIN_CARDS = [];

  JEALOUS_RAW.forEach(function (text, i) {
    App.BUILTIN_CARDS.push({
      id: 'builtin-jealous-' + i,
      category: '修罗场',
      text: text,
      trigger: '',
      enabled: true,
      builtin: true,
    });
  });

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



  /* 默契问答题库：只作为「默契问答」分类的字卡存在，不参与聊天抽卡 */
  App.QUIZ_CATEGORIES = ['日常习惯', '恋爱回忆', '未来规划', '兴趣爱好', '口味偏好', '小秘密'];

  const QUIZ_BANK = {
    日常习惯: [
      '对方早上起床后第一件事通常是什么？',
      '对方睡觉喜欢侧睡还是平躺？',
      '对方刷牙时习惯用左手还是右手？',
      '对方出门前一定会带上什么？',
      '对方洗澡一般要多久？',
      '对方的衣服通常谁叠？',
      '对方习惯几点吃晚饭？',
      '对方喝水更喜欢温水还是冰水？',
      '对方睡前会看手机吗？',
      '对方换下来的袜子通常放在哪里？',
      '对方下雨天会带伞吗？',
      '对方更喜欢早起还是晚睡？',
      '对方吃完饭会立刻洗碗吗？',
      '对方出门喜欢背什么包？',
      '对方一天大概喝几杯水？',
      '对方剪指甲一般多久一次？',
      '对方充电线一般放在哪里？',
      '对方习惯用哪只手拿手机？',
      '对方洗澡先洗头还是先洗身体？',
      '对方周末通常几点起床？',
      '对方喜欢开灯睡还是关灯睡？',
      '对方出门前会照镜子多久？',
    ],
    恋爱回忆: [
      '我们第一次见面是在什么地方？',
      '我们第一次约会看的什么电影？',
      '我们第一次牵手是什么时候？',
      '我们第一次一起吃的饭是什么？',
      '我第一次送你的礼物是什么？',
      '你第一次叫我什么昵称？',
      '我们第一次一起看的电影是哪部？',
      '我们第一次吵架是因为什么？',
      '我们第一次一起旅行去了哪里？',
      '我们第一次合照是在哪里拍的？',
      '我们第一次一起过生日是哪一年？',
      '我第一次夸你是什么时候？',
      '我们第一次一起看的海在哪里？',
      '我们第一次一起淋雨是什么时候？',
      '我们第一次互道晚安是哪一天？',
      '我们第一次一起做饭做了什么？',
      '我们第一次一起唱的歌是什么？',
      '我们第一次一起坐的地铁是哪条线？',
      '我们第一次一起过的节是哪个？',
      '你第一次为我哭是因为什么？',
      '我们第一次一起看烟花在哪里？',
      '我们第一次说喜欢是在什么地方？',
    ],
    未来规划: [
      '我们以后想住在哪个城市？',
      '我们计划几年内一起旅行一次？',
      '我们最想一起去哪个国家？',
      '我们未来想要几个孩子？',
      '我们想养猫还是养狗？',
      '我们梦想中的家是什么样子？',
      '我们退休后想住在哪里？',
      '我们想先买房还是先旅行？',
      '我们希望几年后结婚？',
      '我们想一起学什么新技能？',
      '我们未来想开一家什么店？',
      '我们想给未来的宠物取什么名字？',
      '我们计划每年存多少钱？',
      '我们想一起去看哪一场演唱会？',
      '我们未来想住高层还是带院子？',
      '我们希望未来的厨房是什么样？',
      '我们想一起完成哪件大事？',
      '我们未来想一起去哪里看雪？',
      '我们计划什么时候一起看极光？',
      '我们未来想怎么过结婚纪念日？',
      '我们想一起学做哪道菜？',
      '我们老了以后想一起做什么？',
    ],
    兴趣爱好: [
      '对方最喜欢的歌手是谁？',
      '对方最喜欢的一部电影是什么？',
      '对方最喜欢的一本书是什么？',
      '对方最喜欢的运动是什么？',
      '对方最喜欢的游戏是什么？',
      '对方最喜欢的颜色是什么？',
      '对方最喜欢的季节是什么？',
      '对方最喜欢的动物是什么？',
      '对方最喜欢的城市是哪里？',
      '对方最喜欢的饮料是什么？',
      '对方最喜欢的水果是什么？',
      '对方最喜欢的一道菜是什么？',
      '对方最喜欢的花是什么？',
      '对方最喜欢一天里的哪个时段？',
      '对方最喜欢的天气是什么？',
      '对方最喜欢的一首歌是什么？',
      '对方最喜欢的零食是什么？',
      '对方最喜欢的动漫角色是谁？',
      '对方最想学会的乐器是什么？',
      '对方最喜欢的旅行方式是什么？',
      '对方最喜欢的拍照姿势是什么？',
      '对方最喜欢的节日是哪个？',
    ],
    口味偏好: [
      '对方吃火锅必点什么？',
      '对方吃面喜欢加醋吗？',
      '对方能接受香菜吗？',
      '对方喜欢甜豆花还是咸豆花？',
      '对方吃西瓜喜欢切块还是用勺挖？',
      '对方喝奶茶喜欢几分糖？',
      '对方吃饺子喜欢蘸醋还是酱油？',
      '对方吃辣的程度如何？',
      '对方早餐更喜欢中式还是西式？',
      '对方吃披萨喜欢什么口味？',
      '对方吃烧烤必点的是什么？',
      '对方喝咖啡加不加糖？',
      '对方喜欢吃什么馅的月饼？',
      '对方吃芒果会过敏吗？',
      '对方喜欢榴莲吗？',
      '对方吃薯条喜欢番茄酱还是甜辣酱？',
      '对方喝汤喜欢先喝还是饭后喝？',
      '对方吃鱼喜欢清蒸还是红烧？',
      '对方喜欢喝冰美式还是热拿铁？',
      '对方吃粽子喜欢甜的还是咸的？',
      '对方吃鸡蛋喜欢溏心还是全熟？',
      '对方最喜欢的夜宵是什么？',
    ],
    小秘密: [
      '对方最害怕的东西是什么？',
      '对方小时候的梦想是什么？',
      '对方最不想让人知道的小习惯是什么？',
      '对方最尴尬的一次经历是什么？',
      '对方手机里最舍不得删的照片是什么？',
      '对方最想回到哪一年？',
      '对方最崇拜的人是谁？',
      '对方最讨厌别人叫他什么？',
      '对方心情不好时最想做什么？',
      '对方最常说的一句口头禅是什么？',
      '对方最怕别人发现的小秘密是什么？',
      '对方最想对过去的自己说什么？',
      '对方最珍惜的一件东西是什么？',
      '对方最受不了哪种声音？',
      '对方最想去但还没去的地方是哪里？',
      '对方最难为情的一次表白是什么？',
      '对方最想删除的一段聊天记录是什么？',
      '对方最开心的一个生日是哪一年？',
      '对方最怕的一种动物是什么？',
      '对方最想被夸奖哪一点？',
      '对方最不愿意提起的一件事是什么？',
      '对方最想和我一起保守的秘密是什么？',
    ],
  };

  /* 地点字卡：只用于位置地图与「TA 的位置」，不参与聊天抽卡 */
  const PLACE_SEED = [
    ['家', 31.2304, 121.4737],
    ['公司', 31.2361, 121.4872],
    ['学校', 31.2240, 121.4600],
    ['常去的咖啡馆', 31.2332, 121.4810],
    ['散步的公园', 31.2275, 121.4688],
    ['电影院', 31.2398, 121.4705],
    ['超市', 31.2255, 121.4825],
    ['海边', 31.2600, 121.5300],
  ];
  App.BUILTIN_CARDS = App.BUILTIN_CARDS || [];
  PLACE_SEED.forEach(function (item, i) {
    App.BUILTIN_CARDS.push({
      id: 'builtin-place-' + i,
      category: '地点',
      text: item[0],
      trigger: '',
      enabled: true,
      builtin: true,
      place: { lat: item[1], lng: item[2] },
    });
  });

  App.QUIZ_BANK = QUIZ_BANK;
  App.QUIZ_BY_CARD = {};
  let quizIndex = 0;
  Object.keys(QUIZ_BANK).forEach(function (cat) {
    QUIZ_BANK[cat].forEach(function (question) {
      const id = 'builtin-quiz-' + quizIndex++;
      App.BUILTIN_CARDS.push({
        id: id,
        category: '默契问答',
        quizCat: cat,
        text: question,
        trigger: '',
        enabled: true,
        builtin: true,
      });
      App.QUIZ_BY_CARD[id] = { question: question, quizCat: cat };
    });
  });

  /* 追加卡示例：kind=next 表示说完主卡后追发一条；kind=noreply 表示你没及时回复时 TA 追问 */
  App.BUILTIN_CARDS.push({
    id: 'builtin-followup-0',
    category: '追加',
    kind: 'next',
    parentId: 'builtin-chat-8',
    text: '想我了就直说，我又不会笑话你。',
    trigger: '',
    enabled: true,
    builtin: true,
  });
  App.BUILTIN_CARDS.push({
    id: 'builtin-followup-1',
    category: '追加',
    kind: 'noreply',
    parentId: 'builtin-chat-29',
    delaySec: 60,
    text: '睡着了吗？那明天早上再聊，做个好梦。',
    trigger: '',
    enabled: true,
    builtin: true,
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
        musicPlayProb: 100,
        musicFavProb: 25,
        musicUnfavProb: 15,
        musicSwitchProb: 30,
        musicInviteProb: 5,
        jealousyProb: 30,
        contextReplyEnabled: true,
        followupDelaySec: 60,
        iconsFollowTheme: true,
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
      /* 追加的日常用品 */
      { id: 'p-comb', name: '气垫梳', price: 23, icon: '🪮', fav: { me: false, ta: false } },
      { id: 'p-hairdry', name: '干发帽', price: 24, icon: '🧖', fav: { me: false, ta: false } },
      { id: 'p-soap', name: '香皂', price: 8, icon: '🧼', fav: { me: false, ta: false } },
      { id: 'p-bag', name: '帆布袋', price: 49, icon: '👜', fav: { me: false, ta: false } },
      { id: 'p-keychain', name: '钥匙扣', price: 16, icon: '🔑', fav: { me: false, ta: false } },
      { id: 'p-calendar', name: '桌面日历', price: 21, icon: '📅', fav: { me: false, ta: false } },
      { id: 'p-speaker', name: '小音箱', price: 99, icon: '🔊', fav: { me: false, ta: false } },
      /* 追加的小吃 */
      { id: 'p-eggroll', name: '蛋卷', price: 11, icon: '🥠', fav: { me: false, ta: false } },
      { id: 'p-ricecracker', name: '米饼', price: 7, icon: '🍘', fav: { me: false, ta: false } },
      { id: 'p-hotpot', name: '自热火锅', price: 32, icon: '🍲', fav: { me: false, ta: false } },
      { id: 'p-konjac', name: '魔芋爽', price: 9, icon: '🥡', fav: { me: false, ta: false } },
      { id: 'p-chickenfeet', name: '泡椒凤爪', price: 16, icon: '🐔', fav: { me: false, ta: false } },
      { id: 'p-nugget', name: '鸡米花', price: 18, icon: '🍤', fav: { me: false, ta: false } },
      { id: 'p-edamame', name: '盐水毛豆', price: 12, icon: '🫛', fav: { me: false, ta: false } },
      /* 追加的甜品 */
      { id: 'p-mousse', name: '慕斯杯', price: 26, icon: '🥣', fav: { me: false, ta: false } },
      { id: 'p-brownie', name: '布朗尼', price: 22, icon: '🍫', fav: { me: false, ta: false } },
      { id: 'p-waffle', name: '华夫饼', price: 19, icon: '🧇', fav: { me: false, ta: false } },
      /* 追加的饮品与水果 */
      { id: 'p-orangejuice', name: '鲜榨橙汁', price: 15, icon: '🍊', fav: { me: false, ta: false } },
      { id: 'p-greentea', name: '茉莉绿茶', price: 10, icon: '🍵', fav: { me: false, ta: false } },
      { id: 'p-grape', name: '阳光玫瑰葡萄', price: 45, icon: '🍇', fav: { me: false, ta: false } },
      { id: 'p-blueberry', name: '蓝莓', price: 28, icon: '🫐', fav: { me: false, ta: false } },
      { id: 'p-peach', name: '水蜜桃', price: 20, icon: '🍑', fav: { me: false, ta: false } },
      { id: 'p-pineapple', name: '菠萝', price: 16, icon: '🍍', fav: { me: false, ta: false } },
      { id: 'p-coconut', name: '椰子', price: 20, icon: '🥥', fav: { me: false, ta: false } },
      { id: 'p-orange', name: '橙子', price: 15, icon: '🍊', fav: { me: false, ta: false } },
      { id: 'p-banana', name: '香蕉', price: 8, icon: '🍌', fav: { me: false, ta: false } },
    ];
  };

  /* 集市商品分组：按 id 归类，列表里水果等分类单独成组 */
  App.MARKET_CATEGORIES = [
    {
      name: '日常用品',
      ids: ['p-moon', 'p-tissue', 'p-toothbrush', 'p-towel', 'p-laundry', 'p-umbrella', 'p-thermos', 'p-slippers', 'p-lamp', 'p-storage',
        'p-candle', 'p-cable', 'p-pillow', 'p-eyemask', 'p-earplug', 'p-notebook', 'p-pen', 'p-mug', 'p-socks', 'p-mask',
        'p-mirror', 'p-hairclip', 'p-tape', 'p-sponge', 'p-detergent', 'p-tissuebox', 'p-hanger', 'p-clock', 'p-plant', 'p-thermometer',
        'p-bandage', 'p-comb', 'p-hairdry', 'p-soap', 'p-bag', 'p-keychain', 'p-calendar', 'p-speaker'],
    },
    {
      name: '小吃',
      ids: ['p-latiao', 'p-chips', 'p-popcorn', 'p-sausage', 'p-oden', 'p-noodle', 'p-beefjerky', 'p-seeds', 'p-nuts', 'p-jelly',
        'p-biscuit', 'p-seaweed', 'p-duckneck', 'p-corn', 'p-teaegg', 'p-sweetpotato', 'p-skewer', 'p-friedchicken', 'p-eggroll', 'p-ricecracker',
        'p-hotpot', 'p-konjac', 'p-chickenfeet', 'p-nugget', 'p-edamame'],
    },
    {
      name: '甜品',
      ids: ['p-cake', 'p-eggtart', 'p-pudding', 'p-macaron', 'p-icecream', 'p-tiramisu', 'p-donut', 'p-croissant', 'p-mochi', 'p-creampuff',
        'p-chocolate', 'p-cookies', 'p-pancake', 'p-mousse', 'p-brownie', 'p-waffle'],
    },
    {
      name: '饮品',
      ids: ['p-cocoa', 'p-milktea', 'p-latte', 'p-lemontea', 'p-soda', 'p-soymilk', 'p-orangejuice', 'p-greentea'],
    },
    {
      name: '水果',
      ids: ['p-strawberry', 'p-cherry', 'p-mango', 'p-watermelon', 'p-grape', 'p-blueberry', 'p-peach', 'p-pineapple', 'p-coconut', 'p-orange', 'p-banana'],
    },
  ];
})();
