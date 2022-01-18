const fs = require('fs');
const zlib = require('zlib');
const rimraf = require("rimraf")

var archiver = require('archiver');
const path = require('path')
let directory = path.join(require.main.path,"public")



async function Models_Builder(Models=[],id=0,req,res) {
	
    if(!fs.existsSync(`${directory}/${id}`)){
        fs.mkdirSync(`${directory}/${id}`)
    }

    let dir = `${directory}/${id}`

    //save backup
    fs.writeFileSync(`${dir}/db.json`,JSON.stringify(Models))
    var listOfFiles = [{dir:`${dir}/db.json`,fname:`db.json`}];

}

module.exports = Models_Builder