/* 内置字卡与初始状态（原创文案） */
(function () {
  const App = (window.App = window.App || {});

  App.CATEGORIES = ['聊天', '拍一拍', '情绪', '语音'];

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

  /* 情绪：带情绪与链接强度，会在气泡下方展示 */
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
      strength: row[2],
      trigger: '',
      enabled: true,
      builtin: true,
    });
  });

  const MINE_STICKER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><radialGradient id='g1' cx='50%25' cy='50%25' r='60%25'><stop offset='0%25' stop-color='%23ffe4ef'/><stop offset='100%25' stop-color='%23ffc8dc'/></radialGradient></defs><rect width='120' height='120' fill='url(%23g1)'/><g fill='%23ff8fb8' opacity='.75'><path d='M22 22 l4 6 6 -2 -4 6 -6 -2 z'/><path d='M92 16 l3 5 5 -2 -3 5 -5 -2 z'/><path d='M56 102 l3 4 5 -1 -3 4 -5 -1 z'/></g><g fill='%23d2d6db' stroke='%23333' stroke-width='2.5' stroke-linejoin='round'><path d='M30 58 L22 28 L46 46 Z'/><path d='M90 58 L98 28 L74 46 Z'/><ellipse cx='60' cy='66' rx='36' ry='30'/></g><path d='M42 60 l5 5 M50 60 l-5 5' stroke='%23333' stroke-width='2.5' stroke-linecap='round'/><path d='M70 60 l5 5 M78 60 l-5 5' stroke='%23333' stroke-width='2.5' stroke-linecap='round'/><path d='M50 80 Q60 88 70 80' stroke='%23333' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='44' cy='74' r='4' fill='%23ffb3cc' opacity='.7'/><circle cx='76' cy='74' r='4' fill='%23ffb3cc' opacity='.7'/></svg>";

  const TA_STICKER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><radialGradient id='g2' cx='50%25' cy='50%25' r='60%25'><stop offset='0%25' stop-color='%23ffe4ef'/><stop offset='100%25' stop-color='%23ffc0d8'/></radialGradient></defs><rect width='120' height='120' fill='url(%23g2)'/><g fill='%23ff8fb8' opacity='.55'><path d='M8 28 l4 6 6 -2 -4 6 -6 -2 z'/><path d='M100 18 l3 5 5 -2 -3 5 -5 -2 z'/><path d='M6 82 l4 6 6 -2 -4 6 -6 -2 z'/><path d='M104 94 l3 5 5 -2 -3 5 -5 -2 z'/></g><g fill='%23d2d6db' stroke='%23333' stroke-width='2.5' stroke-linejoin='round'><path d='M28 64 L20 36 L44 52 Z'/><path d='M92 64 L100 36 L76 52 Z'/><ellipse cx='60' cy='74' rx='38' ry='32'/></g><path d='M48 30 q-8 -18 4 -24 q12 6 4 24' fill='%23f5d0c0' stroke='%23333' stroke-width='2.5'/><line x1='46' y1='28' x2='40' y2='18' stroke='%23c79a82' stroke-width='2'/><line x1='52' y1='26' x2='52' y2='14' stroke='%23c79a82' stroke-width='2'/><line x1='58' y1='28' x2='64' y2='18' stroke='%23c79a82' stroke-width='2'/><circle cx='46' cy='72' r='8' fill='%23222'/><circle cx='74' cy='72' r='8' fill='%23222'/><circle cx='49' cy='69' r='2.5' fill='%23fff'/><circle cx='77' cy='69' r='2.5' fill='%23fff'/><path d='M52 88 Q60 94 68 88' stroke='%23333' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='38' cy='84' r='5' fill='%23ffb3cc' opacity='.7'/><circle cx='82' cy='84' r='5' fill='%23ffb3cc' opacity='.7'/></svg>";

  App.DEFAULT_STICKERS = { mine: [MINE_STICKER], ta: [TA_STICKER] };

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
      profile: {
        userName: '我',
        userAvatar: '🍊',
        since: localDate(d),
      },
      settings: {
        replyMin: 1,
        replyMax: 2,
        typingMs: 700,
        emotionProb: 30,
        taLikeProb: 60,
        taCommentProb: 40,
        taMomentCards: 1,
      },
      contacts: [
        { id: contactId, name: '阿眠', avatar: '🌙', note: '住在隔壁的夜猫子' },
      ],
      chats: {
        [contactId]: [
          { id: 'm-welcome', role: 'ta', text: '你来啦。今天过得怎么样？', ts: Date.now() },
        ],
      },
      cards: App.BUILTIN_CARDS.map(function (c) { return Object.assign({}, c); }),
      stickers: App.DEFAULT_STICKERS,
    };
  };
})();
