const NewModelBtn = document.querySelector('.NewModel')
const rightPainel = document.querySelector('.rightPainel')
const SaveModelBtn = document.querySelector('.SaveModel')
const newFieldbtn = document.querySelector('.NewField')
const PropietiesEditor = document.querySelector('.PropietiesEditor')
const SavePropitiesBtn = document.querySelector('#SavePropitiesBtn')
const CancelPropitiesBtn = document.querySelector('#CancelPropitiesBtn')
const GenNewAssociationBtn = document.querySelector('.NewAssociation')
const Associations =  document.querySelector(".Associations").querySelector('ul')


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
        console.log(AllDivs)

        AllDivs[1].querySelector('input').value = field.name
        AllDivs[1].setAttribute('data-config',JSON.stringify(field))
        AllDivs[2].setAttribute('data-config',JSON.stringify(field.propieties))
        AllDivs[2].querySelector('select').value = field.type
        console.log(field)
        
        Fields_Area.appendChild(newField)
    }
    
    for(let assoc of config.Associations) {
        let newA = GenNewAssociation()
        newA.querySelector('div').querySelectorAll('div')[0].querySelectorAll('select')[0].value = assoc.type
        newA.querySelector('div').querySelectorAll('div')[0].querySelectorAll('select')[1].value = assoc.to
        Associations.appendChild(newA)
        console.log(newA)
    }

    Model_name.textContent = config.name
}

//Create a new Model
function AddNewModel(){
    document.querySelector('.ModelsList').querySelector('ul').appendChild(GenModelStructure())
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
    console.log(divAtual)

    SetModelEditView(divAtual)

}

function addField() {
    if(ActualModel==undefined) {
        alert("Você não está editando nenhum model!")
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

document.querySelector('.ID').value = Math.floor(Math.random() * 8000)


function download(data, filename="database.json", type='text/plain') {
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