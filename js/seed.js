/* 内置字卡与初始状态（原创文案） */
(function () {
  const App = (window.App = window.App || {});

  App.CATEGORIES = ['日常', '撒娇', '关心', '吐槽', '深夜', '鼓励'];

  const RAW = [
    ['日常', '今天路过一家面包店，闻到黄油味就想起你了。', ''],
    ['日常', '刚睡醒，头发乱得像被风揉过。你呢？', ''],
    ['日常', '中午吃了碗热汤面，胃里暖了很久。', ''],
    ['日常', '窗外的云走得很慢，我也没什么急事。', ''],
    ['日常', '拍一拍', '拍'],
    ['日常', '刚洗完衣服，阳台上一排小旗子。', ''],
    ['日常', '今天的风有点甜，可能是路过花店沾上的。', ''],
    ['日常', '在地铁上看到一只很乖的橘猫，可惜没拍清。', '猫'],
    ['日常', '刚泡了杯茶，热气把眼镜糊住了。', ''],
    ['撒娇', '你今天有没有想我，老实回答。', '想你'],
    ['撒娇', '我不管，反正你要先理我。', ''],
    ['撒娇', '分你一半耳机，歌单不许嫌弃。', ''],
    ['撒娇', '想被你揉揉脑袋，就一下。', ''],
    ['撒娇', '我在你旁边坐一会儿，不说话也行。', ''],
    ['撒娇', '你今天夸我一句，我就乖一整天。', ''],
    ['关心', '记得吃饭，别又拿咖啡当午饭。', '吃饭'],
    ['关心', '如果累了就早点睡，消息可以明天回。', '累'],
    ['关心', '天凉了，出门加件外套。', '冷'],
    ['关心', '喝水了吗？现在，立刻，一口。', ''],
    ['关心', '别总皱着眉，事情一件一件来。', ''],
    ['关心', '到家跟我说一声，我等你。', '到家'],
    ['吐槽', '你这句话敷衍得像复制粘贴的。', ''],
    ['吐槽', '行吧，你赢了，但我不服。', ''],
    ['吐槽', '我又没生气，我只是在组织语言。', '生气'],
    ['吐槽', '你这个表情，我截图存证了。', ''],
    ['吐槽', '再说一遍？我假装没听见。', ''],
    ['吐槽', '好好好，你说的都对（小声）。', ''],
    ['深夜', '夜深了，把手机亮度调低一点。', ''],
    ['深夜', '睡不着的话，我们随便聊点什么。', '失眠'],
    ['深夜', '今天的月亮很淡，像被水洗过。', ''],
    ['深夜', '晚安，梦里要是遇见我，记得打招呼。', '晚安'],
    ['深夜', '我把今天最后一句留给你。', ''],
    ['深夜', '别熬太晚，明天还要好好生活。', '熬夜'],
    ['鼓励', '你已经做得很好了，真的。', ''],
    ['鼓励', '慢一点也没关系，路不会跑。', ''],
    ['鼓励', '这次没成，下次换个方式再来。', '失败'],
    ['鼓励', '你身上有很多你自己没看见的好。', ''],
    ['鼓励', '先深呼吸，然后把最小的一件事做完。', ''],
    ['鼓励', '我在，不用一个人扛。', '难过'],
  ];

  App.BUILTIN_CARDS = RAW.map(function (row, i) {
    return {
      id: 'builtin-' + i,
      category: row[0],
      text: row[1],
      trigger: row[2],
      enabled: true,
      builtin: true,
    };
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
