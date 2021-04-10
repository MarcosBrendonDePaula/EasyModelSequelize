const fs = require('fs');
const zlib = require('zlib');
const rimraf = require("rimraf")

var archiver = require('archiver');
const path = require('path')
let directory = path.join(__dirname,"public")

function existModel(Models,name) {
    for(let model of Models) {
        if(model.name===name)
            return true
    }
    return false
}

async function MakeModels(Models=[],id=0,req,res) {
	if(!fs.existsSync(`${directory}/${id}`)){
        fs.mkdirSync(`${directory}/${id}`)
    }

    let dir = `${directory}/${id}`

    //save backup
    fs.writeFileSync(`${dir}/db.json`,JSON.stringify(Models))
    var listOfFiles = [{dir:`${dir}/db.json`,fname:`db.json`}];

    for(model of Models) {
        let fields = "\r"
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
            let field = `const ${assoc.to} = require('./${assoc.to}')\;\n`
            
            if(requires.includes(field)==false){
                requires.push(field)
            }

            if(assoc.type=="M:N") {
                if(existModel(Models,`${model.name}_${assoc.to}`)) {
                    let requer = `const ${model.name}_${assoc.to} = require('./${model.name}_${assoc.to}')\n`
                    requires.push(requer)
                }
            }
        }
        
        let Texrequires = "\r"
        for(let r of requires) {
            Texrequires+=r
        }

        let assocTex = ""
        for(let assoc of model.Associations) {
            switch(assoc.type) {
                
                case "1:1": {
                    assocTex+=`${model.name}.hasOne(${assoc.to});\n`
                    break
                }
                
                case "1:M": {
                    assocTex+=`${model.name}.hasMany(${assoc.to});\n`
                    assocTex+=`${assoc.to}.belongsTo(${model.name});\n`
                    break
                }

                case "M:N": {
                    let exist = existModel(Models,`${model.name}_${assoc.to}`)
                    if(!exist) {
                        assocTex+=`${model.name}.belongsToMany(${assoc.to},{ through: '${model.name}_${assoc.to}'});\n`
                        assocTex+=`${assoc.to}.belongsToMany(${model.name},{ through: '${model.name}_${assoc.to}'});\n`
                    }else {
                        assocTex+=`${model.name}.belongsToMany(${assoc.to},{ through: ${model.name}_${assoc.to}});\n`
                        assocTex+=`${assoc.to}.belongsToMany(${model.name},{ through: ${model.name}_${assoc.to}});\n`
                    }
                    break
                }
            }
        }
        
        let modelname = model.name
        modelname = modelname.replace(" ","_");

        let layout = `const Sequelize = require('sequelize')`+
            `\rconst sequelize = global.sequelize`+
            `\r//requires`+
            `${Texrequires}`+
            `\rconst ${modelname} = sequelize.define('${modelname}', {`+
            `\t${fields}`+
            `\r});`+
            `\r//associations`+
            `\r${assocTex}`+
            `\r(async()=>{`+
            `\r\tawait sequelize.sync();`+
            `\r})();`+
            `\rmodule.exports = ${modelname}`

        fs.writeFileSync(`${dir}/${model.name}.js`,layout)
        listOfFiles.push({dir:`${dir}/${model.name}.js`,fname:`${model.name}.js`})
    }
    
    var output = fs.createWriteStream(`${directory}/${id}/files.zip`);

    output.on('close', function() {
        res.redirect(`/${id}/files.zip`)
        setTimeout(function() {
            rimraf(dir,()=>{})
        }, 60000);
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