const fs = require('fs');
const zlib = require('zlib');
const rimraf = require("rimraf")

var archiver = require('archiver');
const path = require('path')
let directory = path.join(require.main.path,"public")

function existModel(Models,name) {
    for(let model of Models) {
        if(model.name===name)
            return true
    }
    return false
}
function ConnectionLayout() {
    return `"use strict";
const Sequelize = require('sequelize')
const fs=require('fs')
const path=require('path')

var Models = {}
var Instance = undefined

const database = process.env.SDB    || 'database' 
const username = process.env.SUSER  || 'ADMIN'
const password = process.env.SPASSW || 'ADMIN'
const host     = process.env.SHOST  || '0.0.0.0'

const Connect = async ( Options = {} )=>{
    Instance = new Sequelize(database, username, password, {
        host: host,
        dialect: 'postgres',
        //remove if not necessary
        define: {
            freezeTableName: true
        },
    });
    
    try {
        let folder = path.dirname(require.resolve("./__connect__"));
        let res    = await Instance.authenticate();
        
         
        const models = fs.readdirSync(folder)
        for(let i of models) {
            let file = i.split('.')
            if (file[1]=="js" && file[0].indexOf("__connect__") != 0) {
                let module = await require(path.resolve(folder,file[0]))(Instance)
                Models[file[0]] = module
            }
        }
        await Instance.sync()
    } catch (error) {
        console.log(error)
    }
    return Models
}

module.exports = {
    Connect,
    Models,
	Instance
}`
}

async function Models_Builder(Models=[],id=0,req,res) {
	
    if(!fs.existsSync(`${directory}/${id}`)){
        fs.mkdirSync(`${directory}/${id}`)
    }

    let dir = `${directory}/${id}`

    //save backup
    fs.writeFileSync(`${dir}/db.json`,JSON.stringify(Models))
    var listOfFiles = [{dir:`${dir}/db.json`,fname:`db.json`}];

    let model_space_base = "\r\t\t"
    for(model of Models) {
        //gerando texto dos campos
        let fields = "\r"
        for(let field of model.Fields) {
            let propties = `${model_space_base}{${model_space_base}\ttype:Sequelize.${field.type},`

            if (field.propieties.PK) {
                propties+=`${model_space_base}\tprimaryKey:${field.propieties.PK},`
            }

            if (field.propieties.AI) {
                propties+=`${model_space_base}\tautoIncrement:${field.propieties.AI},`
            }

            if (field.propieties.DV) {
                propties+=`${model_space_base}\tdefaultValue:${field.propieties.DV},`
            }
            
            if(field.propieties.NN == undefined) {
                propties+=`${model_space_base}\tallowNull:false,`
            }else
                propties+=`${model_space_base}\tallowNull:false,`
            

            propties+=`${model_space_base}}`
            fields+=`${model_space_base}${field.name}:${propties},`

        }
        

        //gerando textos de requerimentos
        let requires = []
        
        for(let assoc of model.Associations) {
            let field = `\r\tconst ${assoc.to} = await require('./${assoc.to}')(sequelize)\;\n`
           
            if(requires.includes(field)==false){
                requires.push(field)
            }

            if(assoc.type=="M:N") {
                if(existModel(Models,`${model.name}_${assoc.to}`)) {
                    let requer = `\r\tconst ${model.name}_${assoc.to} = await require('./${model.name}_${assoc.to}')(sequelize);\n`
                    requires.push(requer)
                }
            }
        }
        
        //concatenação dos requires
        let Texrequires = "\r"
        for(let r of requires) {
            Texrequires+=r
        }

        //gerando texto de associaçoes
        let assocTex = ""
        for(let assoc of model.Associations) {
            switch(assoc.type) {
                
                case "1:1": {
                    assocTex+=`${model_space_base}${"model"}.hasOne(${assoc.to});\n`
					assocTex+=`${model_space_base}${assoc.to}.belongsTo(${"model"});\n`
                    break
                }
                
                case "1:M": {
                    assocTex+=`${model_space_base}${"model"}.hasMany(${assoc.to});\n`
                    assocTex+=`${model_space_base}${assoc.to}.belongsTo(${"model"});\n`
                    break
                }

                case "M:N": {
                    let exist = existModel(Models,`${model.name}_${assoc.to}`)
                    if(!exist) {
                        assocTex+=`${model_space_base}${"model"}.belongsToMany(${assoc.to},{ through: '${model.name}_${assoc.to}'});\n`
                        assocTex+=`${model_space_base}${assoc.to}.belongsToMany(${"model"},{ through: '${model.name}_${assoc.to}'});\n`
                    }else {
                        assocTex+=`${model_space_base}${"model"}.belongsToMany(${assoc.to},{ through: ${model.name}_${assoc.to}});\n`
                        assocTex+=`${model_space_base}${assoc.to}.belongsToMany(${"model"},{ through: ${model.name}_${assoc.to}});\n`
                    }
                    break
                }
            }
        }
        
        let modelname = model.name
        modelname = modelname.replace(" ","_");

        let layout = `"use strict";`+
            `\rconst Sequelize = require('sequelize')`+
            `\r//Model cache instance`+
            `\rvar model = undefined`+
            `\rmodule.exports = async sequelize=> {`+
                `\r\t//Model Check Instance`+
                `\r\tif(model) {`+
                `\r\t\treturn model`+
                `\r\t}\n`+
                `\r\t//requires`+
                `\r\t${Texrequires}`+
                `\r\tmodel = sequelize.define('${modelname}', {`+
                `\r\t\t${fields}`+
                `\r\t});`+
                `\r\t//associations`+
                `\r\t${assocTex}`+
                `\r\treturn model`+
            `\r}`
        fs.writeFileSync(`${dir}/${model.name}.js`,layout)
        listOfFiles.push({dir:`${dir}/${model.name}.js`,fname:`${model.name}.js`})
    }
    
    fs.writeFileSync(`${dir}/__connect__.js`,ConnectionLayout())
    listOfFiles.push({dir:`${dir}/__connect__.js`,fname:`__connect__.js`})

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

module.exports = Models_Builder