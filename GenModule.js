const fs = require('fs');
const zlib = require('zlib');
const rimraf = require("rimraf")

var archiver = require('archiver');
const path = require('path')
let directory = path.join(__dirname,"public")

async function MakeModels(Models=[],id=0,req,res) {
	if(!fs.existsSync(`${directory}/${id}`)){
        fs.mkdirSync(`${directory}/${id}`)
    }

    let dir = `${directory}/${id}`
    var listOfFiles = [];

    for(model of Models) {
        fields = "\r"
        for(let field of model.Fields) {
            let propties = `\r\t{\r\t\ttype:Sequelize.${field.type},`

            if (field.propieties.PK) {
                propties+=`\r\t\tprimaryKey:${field.propieties.PK},`
            }

            if (field.propieties.AI) {
                propties+=`\r\t\tautoIncrement:${field.propieties.AI},`
            }

            if (field.propieties.DV) {
                propties+=`\r\t\tdefaultValue:${field.propieties.DV},`
            }

            if (field.propieties.NN) {
                propties+=`\r\t\tallowNull:${field.propieties.NN},`
            }
            propties+="\r\t}"
            fields+=`\r\t${field.name}:${propties},`
        }
        
        let requires = []
        for(let assoc of model.Associations) {
            let field = `const ${assoc.to} = require('./${assoc.to}')`
            if(requires.includes(field)===false)
                requires.push(field)
        }
        
        Texrequires = "\r"
        for(let r of requires) {
            Texrequires+=r
        }

        let assocTex = ""
        for(let assoc of model.Associations) {
            switch(assoc.type) {
                case "1:1": {
                    assocTex+=`${model.name}.hasOne(${assoc.to});`
                    break
                }
                case "1:M": {
                    assocTex+=`${model.name}.hasMany(${assoc.to});\n`
                    assocTex+=`${assoc.to}.belongsTo(${model.name});`
                    break
                }
                case "M:N": {
                    assocTex+=`${model.name}.belongsToMany(${assoc.to},{ through: '${model.name}_${assoc.to}'});\n`
                    assocTex+=`${assoc.to}.belongsToMany(${model.name},{ through: '${model.name}_${assoc.to}'});`
                    break
                }
            }
        }
        
        let layout = `\rconst Sequelize = require('sequelize')`+
            `\rconst sequelize = global.sequelize`+
            `\r${requires}`+
            `\rconst ${model.name} = sequelize.define('${model.name}', {`+
            `\r\t${fields}`+
            `\r});`+
            `\r//associations`+
            `\r${assocTex}`+
            `\r(async()=>{`+
            `\r\tawait sequelize.sync();`+
            `\r})();`+
            `\rmodule.exports = ${model.name}`

        fs.writeFileSync(`${dir}/${model.name}.js`,layout)
        listOfFiles.push({dir:`${dir}/${model.name}.js`,fname:`${model.name}.js`})
    }
    
    var output = fs.createWriteStream(`${directory}/${id}/files.zip`);

    output.on('close', function() {
        res.redirect(`/${id}/files.zip`)
        setTimeout(function() {
            rimraf(dir,()=>{})
        }, 120000);
    });
    

    var archive = archiver('zip', {
        gzip: true,
        zlib: { level: 9 } // Sets the compression level.
    });

    archive.pipe(output);

    for(let i of listOfFiles) {
        archive.append(fs.createReadStream(i.dir), {name: i.fname});
    }
    archive.finalize();
}

module.exports = {
    MakeModels
}