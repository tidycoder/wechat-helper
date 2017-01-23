import {convertEmoji, formatNum} from '../util'
/* Message Object Example
{
    "FromUserName": "",
    "ToUserName": "",
    "Content": "",
    "StatusNotifyUserName": "",
    "ImgWidth": 0,
    "PlayLength": 0,
    "RecommendInfo": {},
    "StatusNotifyCode": 4,
    "NewMsgId": "",
    "Status": 3,
    "VoiceLength": 0,
    "ForwardFlag": 0,
    "AppMsgType": 0,
    "Ticket": "",
    "AppInfo": {...},
    "Url": "",
    "ImgStatus": 1,
    "MsgType": 1,
    "ImgHeight": 0,
    "MediaId": "",
    "MsgId": "",
    "FileName": "",
    "HasProductId": 0,
    "FileSize": "",
    "CreateTime": 0,
    "SubMsgType": 0
}
*/

const messageProto = {
  init: function (instance) {
    this.MsgType = +this.MsgType
    this.isSendBySelf = this.FromUserName === instance.user.UserName || this.FromUserName === ''

    this.OriginalContent = this.Content
    if (this.FromUserName.indexOf('@@') === 0) {
      this.Content = this.Content.replace(/^@.*?(?=:)/, match => {
        let user = instance.contacts[this.FromUserName].MemberList.find(member => {
          return member.UserName === match
        })
        this.FromGroupMember = match
        this.FromGroupMemberName = user ? instance.Contact.getDisplayName(user) : match
        this.FromGroup = true
        this.FromGroupName = instance.contacts[this.FromUserName].NickName
        return user ? instance.Contact.getDisplayName(user) : match
      })
    }
    if (this.isSendBySelf && this.ToUserName.indexOf('@@') === 0) {
      this.FromGroupMember = instance.user.UserName
      this.FromGroupMemberName = instance.user.NickName 
      this.FromGroup = true
      this.FromGroupName = instance.contacts[this.ToUserName].NickName
    }

    this.Content = this.Content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<br\/>/g, '\n')
    this.Content = convertEmoji(this.Content)

    return this
  },
  isSendBy: function (contact) {
    return this.FromUserName === contact.UserName
  },
  getPeerUserName: function () {
    return this.isSendBySelf ? this.ToUserName : this.FromUserName
  },
  getDisplayTime: function () {
    var time = new Date(1e3 * this.CreateTime)
    return time.getHours() + ':' + formatNum(time.getMinutes(), 2)
  }
}

export default function MessageFactory (instance) {
  return {
    extend: function (messageObj) {
      const messageCopy = Object.assign({}, messageObj)
      const wechatLayer = Object.setPrototypeOf(messageCopy, messageProto)
      const messageLayer = Object.setPrototypeOf({}, wechatLayer)
      return messageLayer.init(instance)
    }
  }
}
