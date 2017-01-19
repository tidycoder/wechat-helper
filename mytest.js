// var QRCode = require('qrcode')

// var path = './qrcode' + Date.now() + '.png'
// QRCode.save(path, 'I am a pony!', function (err, url) {
//   console.log(url);
// })

const bl = require('bl')
const FormData = require('form-data')

const fs = require('fs')
const path = require('path')


var parentDir = path.resolve(process.cwd(), '..')
console.log(parentDir)

var targetFilePath = parentDir + '/qrcode/1484650928324.png'
fs.readFile(targetFilePath, function (err, buffer) {
        var form = new FormData()
        form.append('name', 'filename')
        form.append('type', 'image/png')
        form.append('size', 830)
        form.append('mediatype', 'pic')
        form.append('filename', buffer, {
          filename: 'filename',
          contentType: 'image/png',
          knownLength: 830 
        })

            form.pipe(bl(function(err, buffer2){
                console.log(form.getHeaders());
                console.log(buffer2);
                console.log(buffer);
            }))
})
