var HOST = location.origin.replace(/^http/, 'ws')
var socket = io.connect(HOST);

const RightPainel = document.querySelector(".rightPainel")
RightPainel.classList.toggle("hidden")

const NewModelBtn = document.querySelector('.NewModel')
const rightPainel = document.querySelector('.rightPainel')
const SaveModelBtn = document.querySelector('.SaveModel')
const newFieldbtn = document.querySelector('.NewField')
const PropietiesEditor = document.querySelector('.PropietiesEditor')
const SavePropitiesBtn = document.querySelector('#SavePropitiesBtn')
const CancelPropitiesBtn = document.querySelector('#CancelPropitiesBtn')
const GenNewAssociationBtn = document.querySelector('.NewAssociation')
const Associations =  document.querySelector(".Associations").querySelector('ul')

var Sala_Atual = 0
var idCounter = 1
var ActualModel = undefined
var ActualField = undefined 

//Basic Actions
NewModelBtn.addEventListener('click',AddNewModel),
SaveModelBtn.addEventListener('click',SaveModel)
newFieldbtn.addEventListener('click',addField)
SavePropitiesBtn.addEventListener('click',SavePropieties)
CancelPropitiesBtn.addEventListener('click',CancelPropieties)
GenNewAssociationBtn.addEventListener('click',AddNewAssociation)

//Generate GUI to model edit
function SetModelEditView(ModelDiv){
    let config = JSON.parse(ModelDiv.getAttribute('data-config'))
    if(!RightPainel.classList.contains("hidden"))
        RightPainel.classList.toggle("hidden")
    RightPainel.classList.toggle("hidden")
    ActualModel = {
        "model":ModelDiv,
        "config":config,
    }

    let Model_name = rightPainel.querySelector(".M_name")
    let Fields_Area = rightPainel.querySelector(".Fields").querySelector("ul")
    Fields_Area.innerHTML=""
    Associations.innerHTML=""
    for(let field of config.Fields) {
        let newField = GenFieldStructure()
        let AllDivs = newField.querySelectorAll('div')
        AllDivs[1].querySelector('input').value = field.name
        AllDivs[1].setAttribute('data-config',JSON.stringify(field))
        AllDivs[2].setAttribute('data-config',JSON.stringify(field.propieties))
        AllDivs[2].querySelector('select').value = field.type
        Fields_Area.appendChild(newField)
    }
    
    for(let assoc of config.Associations) {
        let newA = GenNewAssociation()
        newA.querySelector('div').querySelectorAll('div')[0].querySelectorAll('select')[0].value = assoc.type
        newA.querySelector('div').querySelectorAll('div')[0].querySelectorAll('select')[1].value = assoc.to
        Associations.appendChild(newA)

    }

    Model_name.textContent = config.name
}

//Create a new Model
function AddNewModel(){
    let model = GenModelStructure()
    
    let divModel = model.querySelector('div')
    let Config = JSON.parse(divModel.getAttribute('data-config'))
    
    socket.emit("NewModel",Config)
    document.querySelector('.ModelsList').querySelector('ul').appendChild(model)
    GetModels()
}

//Delete Model Structure
function RemoveModel(event) {
    let divAtual = event.target
    if(divAtual.nodeName=='IMG'){
        divAtual = divAtual.parentElement
    }

    if(ActualModel == divAtual.parentElement.parentElement)
    {
        ActualModel = undefined
    }

    divAtual = divAtual.parentElement.parentElement.parentElement
    socket.emit("RemoverModel",JSON.parse(divAtual.querySelector('div').getAttribute("data-config")))
    let pai = divAtual.parentElement
    pai.removeChild(divAtual)
    GetModels()
}

async function EditModelBtn(event) {
    let divAtual = event.target
    if(divAtual.nodeName=='IMG'){
        divAtual = divAtual.parentElement
    }
    divAtual = divAtual.parentElement.parentElement

    SetModelEditView(divAtual)

}

function addField() {
    if(ActualModel==undefined) {
        alert("You are not editing any templates, create them before trying to edit.")
        return
    }
    let field = GenFieldStructure()
    rightPainel.querySelector('.Fields').querySelector('ul').appendChild(field)
}

function delField(event) {
    let divAtual = event.target
    if(divAtual.nodeName=='IMG'){
        divAtual = divAtual.parentElement
    }
    document.querySelector('.Fields').querySelector('ul').removeChild(divAtual.parentElement.parentElement)
}

function EditPropieties(event) {
    PropietiesEditor.querySelector('.PropMenu').innerHTML=""
    let Type = event.target.parentElement.querySelector('select').value
    let display = GenPropMenuOptions(Type)
    if(display==null){
        return
    }
    PropietiesEditor.classList.toggle('hidden')
    PropietiesEditor.querySelector('.PropMenu').appendChild(display)
    
    ActualField = event.target.parentElement

    let config = JSON.parse(event.target.parentElement.getAttribute('data-config'))

    document.querySelector('.P_K').checked = (config.PK)?config.PK:false
    document.querySelector('.N_N').checked = (config.NN)?config.NN:false
    
    if (document.querySelector('.A_I')) {
        document.querySelector('.A_I').checked = (config.AI)?config.AI:false
    }

    if (document.querySelector('.D_V')) {
        document.querySelector('.D_V').value = (config.DV)?config.DV:""
    }

}

function SavePropieties(event) {
    let config={}

    config['PK'] = document.querySelector('.P_K').checked
    config['NN'] = document.querySelector('.N_N').checked
    
    if (document.querySelector('.A_I')) {
        config['AI'] = document.querySelector('.A_I').checked
    }

    if (document.querySelector('.D_V')) {
        config['DV'] = document.querySelector('.D_V').value
    }

    PropietiesEditor.classList.toggle('hidden')

    ActualField.setAttribute("data-config",JSON.stringify(config))
    ActualField=undefined
    GetModels()
}

function CancelPropieties(event) {
    PropietiesEditor.querySelector('.PropMenu').innerHTML=""
    PropietiesEditor.classList.toggle('hidden')
    ActualField = undefined
}

function SaveModel(event){

    RightPainel.classList.toggle("hidden")


    let Fields_Area = rightPainel.querySelector(".Fields").querySelector("ul")
    let Config = JSON.parse(ActualModel['model'].getAttribute('data-config'))
    let AllFields = Fields_Area.querySelectorAll('li')
    
    Config['Fields'] = []
    if(AllFields)
        for(let field of AllFields){
            let pai = field.querySelector('div')
            let AllDivs = pai.querySelectorAll('div')
            let nconf={
                name:AllDivs[0].querySelector('input').value,
                type:AllDivs[1].querySelector('select').value,
                propieties:JSON.parse(AllDivs[1].getAttribute('data-config'))
            }
            Config['Fields'].push(nconf)
        }
    
    Config['Associations']=[]
    
    let associations = Associations.querySelectorAll('li')
    if(associations)
        for(let assoc of associations){
            let pai = assoc.querySelector('div')
            let AssocDiv = pai.querySelector('div')
            let nconf={
                type:AssocDiv.querySelector('div').querySelectorAll('select')[0].value,
                to:AssocDiv.querySelector('div').querySelectorAll('select')[1].value,
            }
            Config['Associations'].push(nconf)
        }

    socket.emit("Editar_Model",Config)

    ActualModel['model'].setAttribute('data-config',JSON.stringify(Config))
    GetModels()
}

function AddNewAssociation() {
    Associations.appendChild(GenNewAssociation())
}

function delAssociation(event) {
    let divAtual = event.target
    if(divAtual.nodeName=='IMG'){
        divAtual = divAtual.parentElement
    }
    document.querySelector('.Associations').querySelector('ul').removeChild(divAtual.parentElement.parentElement.parentElement.parentElement)
}

function GetModels() {
    let models = document.querySelector('.ModelsList').querySelector('ul').querySelectorAll('li')
    let Models = []
    for(let model of models) {
        let divModel = model.querySelector('div')
        let config = JSON.parse(divModel.getAttribute('data-config')) 
        Models.push(config)
    }

    //let associations = Associations.querySelector('ul').querySelectorAll('li')

    document.querySelector('.FormModels').value = JSON.stringify(Models)
}

function LoadModels() {
    let Models = JSON.parse(prompt("Please enter Json", `[]`));
    for(let model of Models) {
        document.querySelector('.ModelsList').querySelector('ul').appendChild(GenModelStructure(model.name,model))
    }
    GetModels()
}



function download(data, filename="database.json", type='application/json') {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
        url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}

function DownloadBackup() {
    download(document.querySelector('.FormModels').value)
}

function readTextFile()
{
    
    var file = document.querySelector(".file_to_load").files[0];
    var reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = function (evt) {
        Models = JSON.parse(evt.target.result)
        for(let model of Models) {
            socket.emit("NewModel",model)
            document.querySelector('.ModelsList').querySelector('ul').appendChild(GenModelStructure(model.name,model))
        }
        GetModels()
    }
    reader.onerror = function (evt) {
        console.log("erro")
    }
}

document.querySelector('.ID').value = Math.floor(Math.random() * 8000)

function entrar_sala() {
    let salaId = prompt("Irforme o numero da sala",`${Sala_Atual}`);
    socket.emit("EntrarSala",{id:salaId})
}


//SocketJs
socket.on('connect', async(data)=>{
    socket.emit('CriarSala','');
});

socket.on('Atualizar',async(data)=>{
    for(let model of data) {
        document.querySelector('.ModelsList').querySelector('ul').appendChild(GenModelStructure(model.name,model))
    }
    GetModels()
})

socket.on("remover_model",async(data)=>{

    let models = document.querySelector('.ModelsList').querySelector('ul').querySelectorAll('li')
    for(let model of models) {
        let config = JSON.parse(model.querySelector("div").getAttribute("data-config"))
        if(config.name == data.name) {
            document.querySelector('.ModelsList').querySelector('ul').removeChild(model)
        }
    }
})

socket.on("addModel",(model)=>{
    document.querySelector('.ModelsList').querySelector('ul').appendChild(GenModelStructure(model.name,model))
})

socket.on("Atuzlizar_Model",(data)=>{
    let models = document.querySelector('.ModelsList').querySelector('ul').querySelectorAll('li')
    for(let model of models) {
        let config = JSON.parse(model.querySelector("div").getAttribute("data-config"))
        if(config.name == data.name) {
            document.querySelector('.ModelsList').querySelector('ul').removeChild(model)
        }
    }
    document.querySelector('.ModelsList').querySelector('ul').appendChild(GenModelStructure(data.name,data))
})

socket.on("remover_model",(model)=>{
    let models = document.querySelector('.ModelsList').querySelector('ul').querySelectorAll('li')
    for(model of models) {
        let config = JSON.parse(model.querySelector("div").getAttribute("data-config"))
        if(config.name == model.name) {
            document.querySelector('.ModelsList').querySelector('ul').removeChild(model)
        }
    }
})

socket.on("sala_atual",(data)=>{
    Sala_Atual = data.id;
    document.querySelector("#salaid").textContent = `Sua sala atual é : ${Sala_Atual}`
})

socket.on('err',async(data)=>{
    console.log(data)
})