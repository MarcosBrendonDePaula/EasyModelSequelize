const fs = require('fs');
const zlib = require('zlib');
const rimraf = require("rimraf")

var archiver = require('archiver');
const path = require('path')
let directory = path.join(require.main.path,"public")


function ChangeType (Type = "") {
    switch (Type.toLowerCase()) {
        case ("integer") : {
            return "Number"
        }
        
        case ("float") : {
            return "Number"
        }
        
        case ("double") : {
            return "Number"
        }

        case ("real") : {
            return "Number"
        }

        case ("decimal") : {
            return "Number"
        }

        case ("string") : {
            return "String"
        }
        case ("text") : {
            return "String"
        }
        case ("boolean") :{
            return "Boolean"
        }
        
        case ("date") :{
            return "Date"
        }

        case ("blob") : {
            return "Blob"
        }
        
        default : {
            return "undefined"
        }
    }
}

async function Models_Builder(Models=[],id=0,req,res) {
	
    if(!fs.existsSync(`${directory}/${id}`)){
        fs.mkdirSync(`${directory}/${id}`)
    }

    let dir = `${directory}/${id}`

    //save backup
    fs.writeFileSync(`${dir}/db.json`,JSON.stringify(Models))
    var listOfFiles = [{dir:`${dir}/db.json`,fname:`db.json`}];

    let model_space_base = "\r\t"
    for(model of Models) {
        //gerando texto dos campos
        let fields = "\r"
        for(let field of model.Fields) {
            let propties = `${model_space_base}{${model_space_base}\ttype:${ChangeType(field.type)},`

            if (field.propieties.DV) {
                propties+=`${model_space_base}\tdefault:${field.propieties.DV},`
            }
            
            if(field.propieties.NN == undefined) {
                propties+=`${model_space_base}\trequired:true,`
            }else
                propties+=`${model_space_base}\trequired:false,`
            
            propties+=`${model_space_base}}`
            fields+=`${model_space_base}${field.name}:${propties},`
        }
        
        //gerando texto de associaçoes
        let assocTex = ""
        for(let assoc of model.Associations) {
            
            let propties = `${model_space_base}{${model_space_base}\ttype:${ChangeType(field.type)},`

            if (field.propieties.DV) {
                propties+=`${model_space_base}\tdefault:${field.propieties.DV},`
            }
            
            if(field.propieties.NN == undefined) {
                propties+=`${model_space_base}\trequired:true,`
            }else
                propties+=`${model_space_base}\trequired:false,`
            
            propties+=`${model_space_base}}`
            fields+=`${model_space_base}${field.name}:${propties},`
            
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
                    let exist = existModel(Models,`${"model"}_${assoc.to}`)
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
            `\rconst Mongoose = require('mongoose')`+
            `\rmodule.exports = new Mongoose.Schema({`+
            `\r\t${fields}`+
            `\r})`
        fs.writeFileSync(`${dir}/${model.name}.js`,layout)
        listOfFiles.push({dir:`${dir}/${model.name}.js`,fname:`${model.name}.js`})
    }

}

module.exports = Models_Builder