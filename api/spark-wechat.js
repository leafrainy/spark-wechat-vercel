const crypto = require('crypto');
const dotenv = require('dotenv');
const url = require('url');
const querystring = require('querystring');
const xml2js = require('xml2js');
const PocketBase = require('pocketbase/cjs');

dotenv.config();

let userChatHistory = {};
let userLastChatTime = {};
let userStashMsg = {};
let userHasAnswerIng = {};

const emojiObj = {
  "/::)": "微笑",
  "/::~": "伤心",
  "/::B": "心动",
  "/::|": "发呆",
  "/:8-)": "得意",
  "/::<": "哭",
  "/::$": "害羞",
  "/::X": "闭嘴",
  "/::Z": "睡",
  "/::’(": "哭",
  "/::-|": "囧",
  "/::@": "发怒",
  "/::P": "调皮",
  "/::D": "笑",
  "/::O": "惊讶",
  "/::(": "难过",
  "/::+": "酷",
  "/:–b": "流汗",
  "/::Q": "抓狂",
  "/::T": "呕吐",
  "/:,@P": "偷笑",
  "/:,@-D": "幸福的笑",
  "/::d": "事不关己",
  "/:,@o": "撇嘴",
  "/::g": "饿",
  "/:|-)": "又累又困",
  "/::!": "惊恐",
  "/::L": "流汗黄豆",
  "/::>": "高兴",
  "/::,@": "悠闲",
  "/:,@f": "努力",
  "/::-S": "咒骂",
  "/:?": "疑问",
  "/:,@x": "嘘！小声点",
  "/:,@@": "晕了",
  "/::8": "我要疯了",
  "/:,@!": "太倒霉了",
  "/:!!!": "太吓人了",
  "/:xx": "打你",
  "/:bye": "拜拜",
  "/:wipe": "不带这么玩的",
  "/:dig": "不屑",
  "/:handclap": "好啊好啊",
  "/:&-(": "糗大了",
  "/:B-)": "坏笑",
  "/:<@": "不理你",
  "/:@>": "不理你",
  "/::-O": "有点累了",
  "/:>-|": "鄙视你",
  "/:P-(": "好委屈",
  "/::’|": "快哭了",
  "/:X-)": "坏笑",
  "/::*": "么么哒",
  "/:@x": "震惊",
  "/:8*": "可怜",
  "/:pd": "你太过分了",
  "/:<W>": "水果",
  "/:beer": "啤酒",
  "/:basketb": "篮球",
  "/:oo": "乒乓",
  "/:coffee": "咖啡",
  "/:eat": "美食",
  "/:pig": "可爱小猪",
  "/:rose": "送你一朵花",
  "/:fade": "难过",
  "/:showlove": "亲亲",
  "/:heart": "爱心",
  "/:break": "心裂开了",
  "/:cake": "蛋糕",
  "/:li": "闪电劈你"
};
const pb = new PocketBase(process.env.PB);
const payUrl = process.env.PAYURL;
const linkUrl = process.env.LINKURL;
const keywordAutoReply = JSON.parse(process.env.KEYWORD_REPLAY);
module.exports = async function (request, response) {
  const method = request.method;
  const timestamp = request.query.timestamp;
  const nonce = request.query.nonce;
  const signature = request.query.signature;
  const echostr = request.query.echostr;

  if (method === 'GET') {
    const token = process.env.WX_TOKEN;
    const tmpArr = [token, timestamp, nonce].sort();
    const tmpStr = tmpArr.join('');
    const hash = crypto.createHash('sha1').update(tmpStr).digest('hex');
    if (hash === signature) {
      response.status(200).send(echostr);
      return;
    } else {
      response.status(200).send("failed");
      return;
    }
  }

  const xml = request.read().toString();
  const parser = new xml2js.Parser();
  const textMsg = await parser.parseStringPromise(xml);
  // console.log(textMsg);
  const ToUserName = textMsg.xml.ToUserName[0];
  const FromUserName = textMsg.xml.FromUserName[0];
  const CreateTime = textMsg.xml.CreateTime[0];
  const MsgType = textMsg.xml.MsgType[0];
  console.log("收到消息类型：" + MsgType);
  let Content;
  const timeNow = Math.floor(Date.now() / 1000);
  if (MsgType === 'text') {
    Content = textMsg.xml.Content[0];
    console.log("收到文本消息：" + Content)
    if (Object.hasOwnProperty.call(emojiObj, Content)) {
      //用户发送了微信自带表情
      Content = '我发送了表情：' + emojiObj[Content] + '，现在你要怎么做'
    }
    //关键词触发
    if(Content==="会员"){
      const pay_msg = `当前系统仅支持单次1.88元人民币（购买永久VIP），如果同意请<a href="https://${payUrl}?uid=${FromUserName}">点击此处前往购买VIP</a>`;
      console.log("触发关键词自动回复");
      response.status(200).send(formatReply(
        FromUserName,
        ToUserName,
        timeNow,
        pay_msg
      ));
      return
    }
    if(Content==="抖音"){
      
      const ai_msg = `请<a href="https://${linkUrl}?uid=${FromUserName}">点击此处前往抖音名片制作</a>`;
      console.log("触发关键词自动回复");
      response.status(200).send(formatReply(
        FromUserName,
        ToUserName,
        timeNow,
        ai_msg
      ));
      return
    }

    
    console.log("关键词配置：", keywordAutoReply, "文本内容：" + Content, "匹配结果：", Object.hasOwnProperty.call(keywordAutoReply, Content));
    if (Object.hasOwnProperty.call(keywordAutoReply, Content)) {
      //关键词自动回复
      console.log("触发关键词自动回复");
      response.status(200).send(formatReply(
        FromUserName,
        ToUserName,
        timeNow,
        keywordAutoReply[Content]
      ));
      return;

    }
  }


  if (MsgType === 'event') {
    const Event = textMsg.xml.Event[0];
    if (Event === 'subscribe') {
      try{
        //注册用户
        const data = {
          "username": calculateMD5(FromUserName),
          "wx_id":FromUserName,
            
          "email": "",
          "emailVisibility": true,
          "password": FromUserName,
          "passwordConfirm": FromUserName,
          "num": 1,
          "is_vip":0
      };
  
      await pb.collection('link_user').create(data);
      }catch(e){
        console.log(e);
      }
      
      
      response.status(200).send(formatReply(
        FromUserName,
        ToUserName,
        timeNow,
        process.env.SUBSCRIBE_REPLY
      ));
      return;
    } else {
      return response.status(200).send('');
    }
  }
};

function formatReply(ToUserName, FromUserName, CreateTime, Content) {
  return `<xml>
        <ToUserName><![CDATA[${ToUserName}]]></ToUserName>
        <FromUserName><![CDATA[${FromUserName}]]></FromUserName>
        <CreateTime>${CreateTime}</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[${Content}]]></Content>
    </xml>`;
}


function hmacWithShaTobase64(algorithm, data, key) {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data);
  const encodeData = hmac.digest();
  return Buffer.from(encodeData).toString('base64');
}

function calculateMD5(input) {
  const md5Hash = crypto.createHash('md5');
  md5Hash.update(input);
  return md5Hash.digest('hex');
}


  
