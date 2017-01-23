'use strict'
const Wechat = require('../../index')
const debug = require('debug')('wxbot')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const request = require('request')
const _ = require('underscore')
var headIconCache = require('memory-cache');

const MongoClient = require('mongodb').MongoClient
const mongoUrl = 'mongodb://localhost:27017/uuke'
let DB = undefined
const FILE_SERVER_REMOTE = "http://uuke.co:8100"

MongoClient.connect(mongoUrl, function(err, db) {
  if (err === null) DB = db
  else debug('connect to ' + mongoUrl + ' err: ' + err)
})

class WxBot extends Wechat {

  constructor () {
    super()

    this.memberInfoList = []

    this.replyUsers = new Set()
    this.on('message', msg => {
      switch (msg.MsgType) {
        case this.CONF.MSGTYPE_IMAGE:
        case this.CONF.MSGTYPE_VOICE:
        case this.CONF.MSGTYPE_VIDEO:
        case this.CONF.MSGTYPE_TEXT:
          this.onMsg(msg);
          break
        case this.CONF.MSGTYPE_VERIFYMSG:
          this._botVerifyUser(msg)
          break
        case this.CONF.MSGTYPE_STATUSNOTIFY:
          this._botSupervise()
          break
        case 10000:
          this._botInvitationAccepted(msg)
          break
        default:
          debug('======> please add msg handler for type: ' + msg.MsgType)
          break
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

  onMsg(msg) {
    var _this = this
    new Promise((resolve, reject) => {
      var from = msg.FromGroupMemberName || msg.FromUserName
      var headIcon = headIconCache.get(from)
      if (headIcon) {
        resolve(headIcon)
        return
      } else {
        this.getHeadIcon(from).then(data =>  {
          return _this._saveWXfiles(data, from)
        }).then(url => {
          debug(url)
          headIconCache.put(from, url, 24*3600*1000)
          resolve(url)
        })
      }
    }).then(fromHeadIcon => {
      msg.fromHeadIcon = fromHeadIcon
      if (msg.MsgType == this.CONF.MSGTYPE_TEXT) {
        this.onTextMsg(msg);
      }
      if (msg.MsgType == this.CONF.MSGTYPE_IMAGE) {
        this.onImageMsg(msg);
      }
      if (msg.MsgType == this.CONF.MSGTYPE_VOICE) {
        this.onAudioMsg(msg);
      }
      if (msg.MsgType == this.CONF.MSGTYPE_VIDEO) {
        this.onVideoMsg(msg);
      }
    })
  }

  onTextMsg(msg) {
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

  onImageMsg (msg) {
    let persist = _.pick(msg, "MsgId", "MsgType", "Content", "isSendBySelf", "CreateTime", "Url", "ImgWidth", "ImgHeight", "fromHeadIcon")
    persist.FromNickName = this.contacts[msg.FromUserName].NickName;

    let collection = DB.collection('wxmsgs')
    collection.insertOne(persist).then(ret => {
      return this.getMsgImg(msg.MsgId)
    }).then(data =>  {
      return this._saveWXfiles(data, persist.MsgId)
    }).then(url => {
      collection.updateOne({MsgId: persist.MsgId}, {"$set":{"url":url}}).then(ret => {
        debug(persist.MsgId + " store image with url:" + url)
      })
    })
  }

  onAudioMsg(msg) {
    let persist = _.pick(msg, "MsgId", "MsgType", "Content", "isSendBySelf", "CreateTime", "VoiceLength", "Url", "fromHeadIcon")
    persist.FromNickName = this.contacts[msg.FromUserName].NickName;

    let collection = DB.collection('wxmsgs')
    collection.insertOne(persist).then(ret => {
      return this.getVoice(msg.MsgId)
    }).then(data =>  {
      return this._saveWXfiles(data, persist.MsgId)
    }).then(url => {
      collection.updateOne({MsgId: persist.MsgId}, {"$set":{"url":url}}).then(ret => {
        debug(persist.MsgId + " store audio with url:" + url)
      })
    })

  }

  onVideoMsg(msg) {
    let persist = _.pick(msg, "MsgId", "MsgType", "Content", "isSendBySelf", "CreateTime", "PlayLength", "Url", "fromHeadIcon")
    persist.FromNickName = this.contacts[msg.FromUserName].NickName;

    let collection = DB.collection('wxmsgs')
    collection.insertOne(persist).then(ret => {
      return this.getVideo(msg.MsgId)
    }).then(data =>  {
      return this._saveWXfiles(data, persist.MsgId)
    }).then(url => {
      collection.updateOne({MsgId: persist.MsgId}, {"$set":{"url":url}}).then(ret => {
        debug(persist.MsgId + " store video with url:" + url)
      })
    })
  }


  _botSupervise () {
    const message = '我的主人玩微信' + ++this.openTimes + '次啦！'
    for (let user of this.superviseUsers.values()) {
      this.sendMsg(message, user)
      debug(message)
    }
  }

  _saveWXfiles(res, MsgId) {
    console.log(res.type);
    var ext = undefined
    if (res.type.startsWith('image') || res.type.startsWith('audio')) {
      ext = res.type.substring(6)
    }
    if (res.type.startsWith('video')) {
      ext = "mp4"
    }
    return new Promise((resolve, reject) => {
      var filename = MsgId + '.' + ext
      var req = request.post(FILE_SERVER_REMOTE + '/php/upload.php', function(err, resp, body) {
        if (err) { 
          console.log('_saveWXFiles failure:')
          reject(err);
        } else {
          console.log('_saveWXFiles success:')
          var res = JSON.parse(body);
          var url = FILE_SERVER_REMOTE + '/' + res.file_path
          resolve(url);

        }
      })
      var form = req.form(); 
      form.append('file', res.data, {
        filename: filename,
        contentType: res.type
      })
    })

  }

}

exports = module.exports = WxBot
