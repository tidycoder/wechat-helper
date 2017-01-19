'use strict'
const Wechat = require('../../index')
const debug = require('debug')('wxbot')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')


class WxBot extends Wechat {

  constructor () {
    super()

    this.memberInfoList = []

    this.replyUsers = new Set()
    this.on('message', msg => {
      if (msg.msgType != 51) {
        debug(msg)
      }
      if (msg.MsgType === this.CONF.MSGTYPE_TEXT) {
        this._botReply(msg)
      }
    })

    this.superviseUsers = new Set()
    this.openTimes = 0
    this.on('message', msg => {
      if (msg.MsgType === this.CONF.MSGTYPE_STATUSNOTIFY) {
        this._botSupervise()
      }
    })

    this.on('error', err => debug(err))
  }

  get replyUsersList () {
    return this.friendList.map(member => {
      member.switch = this.replyUsers.has(member['UserName'])
      return member
    })
  }

  get superviseUsersList () {
    return this.friendList.map(member => {
      member.switch = this.superviseUsers.has(member['UserName'])
      return member
    })
  }

  _tuning (word) {
    return this.request({
      method: 'GET',
      url: 'http://api.hitokoto.us/rand'
    }).then(res => {
      return res.data.hitokoto
    }).catch(err => {
      debug(err)
      return '现在思路很乱，最好联系下我哥 T_T...'
    })
  }

  _generateQr(link) {
    return new Promise((resolve, reject) => {
      var filename = Date.now() + '.png'
      var parentDir = path.resolve(__dirname, '..')
      var targetFilePath = parentDir + '/qrcode/' + filename
      QRCode.save(targetFilePath, link, function (err, written) {
        if (err) reject(err)
        else resolve({path: targetFilePath, filename: filename})
      })
    })
  }

  _generateQrMsg(link) {
   return this._generateQr(link).then((qr) => {
        var stream = fs.createReadStream(qr.path)
        return {file: stream, filename: qr.filename}
    }) 
  }

  _botReply (msg) {
    if (msg.OriginalContent.endsWith('code')) {
      this._generateQrMsg('http://weixin.qq.com/r/4FdVTXPEDi5xrTcu9wLy').then((pic) => {
        this.sendMsg(pic, msg['FromUserName'])
      })
    }

    if (this.replyUsers.has(msg['FromUserName'])) {
      this._tuning(msg['Content']).then(reply => {
        this.sendText(reply, msg['FromUserName'])
        debug(reply)
      })
    }
  }

  _botSupervise () {
    const message = '我的主人玩微信' + ++this.openTimes + '次啦！'
    for (let user of this.superviseUsers.values()) {
      this.sendMsg(message, user)
      debug(message)
    }
  }

}

exports = module.exports = WxBot
