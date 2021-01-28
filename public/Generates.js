//empty model model
const emptyModel = {
    name:`undefined`,
    Fields:[],
    Associations:[]
}

//empty config model
const emptyAtributes = {
}

const selectionsHTML='<option selected>None</option>'+
'<option data-autoI="" data-size="" value="STRING">STRING</option>'+
'<option value="TEXT">TEXT</option>'+
'<option value="BOOLEAN">BOOLEAN</option>'+
'<option value="INTEGER">INTEGER</option>'+
'<option value="FLOAT">FLOAT</option>'+
'<option value="REAL">REAL</option>'+
'<option value="DOUBLE">DOUBLE</option>'+
'<option value="DECIMAL">DECIMAL</option>'+
'<option value="DATE">DATE</option>'

function AppClass(obj,List){
    for(let classe of List) {
        obj.classList.add(classe)
    }
}

function AppChilds(obj,List) {
    for(let ob of List) {
        obj.appendChild(ob)
    }
}


function NewSpan(text="",classList_=[],Childs=[]) {
    let obj = document.createElement('span')
    obj.innerText = text
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewDiv(classList_=[],Childs=[]) {
    let obj = document.createElement('div')
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewInput(classList_=[],Childs=[]) {
    let obj = document.createElement('input')
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewINumber(classList_=[],Childs=[]) {
    let obj = NewInput()
    obj.type = 'number'
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewCheckBox(classList_=[],Childs=[]) {
    let obj = NewInput()
    obj.type = "checkbox"
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewIdate(classList_=[],Childs=[]) {
    let obj = NewInput()
    obj.type = "date"
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewTextArea(classList_=[],Childs=[]){
    let obj = document.createElement('textarea')
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewButton(classList_=[],Childs=[],action = undefined,text=undefined) {
    let obj = document.createElement('button')
    if(action)
        obj.addEventListener(action.event,action.function)
    if(text)
        obj.textContent=text
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewImg(classList_=[],Childs=[],src="") {
    let obj = document.createElement('img')
    obj.src=src
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewSelect(classList_=[],Childs=[]) {
    let obj = document.createElement('select')
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

function NewOption(classList_=[],Childs=[],text="",value=undefined) {
    let obj = document.createElement('option')
    obj.value = (value)?value:text
    obj.text = text
    AppChilds(obj,Childs)
    AppClass(obj,classList_)
    return obj
}

//Generate a Model Structure
function GenModelStructure(name = undefined,config=undefined) {
    idCounter+=1
    let li = document.createElement('li')

    let div = document.createElement('div') 
    div.classList.add('ModelSelection')
    div.setAttribute('data-name','')
    
    let spanName = document.createElement('span')
    spanName.classList.add('Mname')
    let tname = name

    if(name==undefined) {
        tname = prompt("Please enter Table Name", `T: undefined${idCounter}`);
        if(tname==null || tname.length<1)
            tname=`T: undefined${idCounter}`
    }

    spanName.textContent = tname
    
    if(config) {
        div.setAttribute('data-config',JSON.stringify(config))
    } else {
        let myconf = emptyModel
        myconf['name'] = tname
        div.setAttribute('data-config',JSON.stringify(myconf))
    }

    let menudiv = document.createElement('div')
    menudiv.classList.add('menu')
    
    let bt1 = document.createElement('button')
    let img1 = document.createElement('img')
    img1.src = "https://img.icons8.com/nolan/64/support.png"
    bt1.appendChild(img1)
    bt1.classList.add('editBtn')
    bt1.classList.add('ModelSbtn')
    bt1.addEventListener('click',EditModelBtn)


    let bt2 = document.createElement('button')
    let img2 = document.createElement('img')
    img2.src = "https://img.icons8.com/nolan/64/delete-sign.png"
    bt2.appendChild(img2)
    bt2.classList.add('delBtn')
    bt2.classList.add('ModelSbtn')
    bt2.addEventListener('click',RemoveModel)

    menudiv.appendChild(bt1)
    menudiv.appendChild(bt2)

    div.appendChild(spanName)
    div.appendChild(menudiv)
    li.appendChild(div)
    return li
}

function GenFieldStructure() {
    let li = document.createElement('li')
    let div = document.createElement('div')
    div.classList.add('flex')

    let div1 = document.createElement('div')
    
    let span = document.createElement('span')
    span.textContent="Field Name:"
    let input = document.createElement('input')

    
    let div2 = document.createElement('div')
    div2.setAttribute('data-config',JSON.stringify(emptyAtributes))

    let span1 = document.createElement('span')
    span1.textContent = ' Type:'

    let select = document.createElement('select')
    select.innerHTML = selectionsHTML
    let editprop = document.createElement('button')
    editprop.textContent="EditProperties"
    editprop.addEventListener('click',EditPropieties)

    let button = NewButton(['FieldDelBtn'],[
        NewImg([],[],"https://img.icons8.com/nolan/64/delete-sign.png")
    ])
    
    button.addEventListener('click',delField)

    div2.appendChild(span1)
    div2.appendChild(select)
    div2.appendChild(editprop)

    div1.appendChild(span)
    div1.appendChild(input)

    div.appendChild(div1)
    div.appendChild(div2)
    div.appendChild(button)
    li.appendChild(div)
    return li
}

function GenPropMenuOptions(type,config = {}) {
    
    let PkDiv = NewDiv(classList_=['flex'],Childs=[
        NewSpan(text="PK:"),
        NewCheckBox(classList_=['P_K'])
    ]);
   
    let notNull = NewDiv(classList_=['flex'],Childs=[
        NewSpan(text="AllowNull"),
        NewCheckBox(classList_=['N_N'])
    ])

    switch (type) {
        case "INTEGER" : {
            let AutoIncrement = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="AutoIncrement"),
                NewCheckBox(classList_=['A_I'])
            ])
            
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewINumber(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                AutoIncrement,
                defaultValue
            ])
        }

        case "BIGINT" : {
            let AutoIncrement = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="AutoIncrement"),
                NewCheckBox(classList_=['A_I'])
            ])
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewINumber(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                AutoIncrement,
                defaultValue
            ])
        }

        case "FLOAT" : {
            let AutoIncrement = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="AutoIncrement"),
                NewCheckBox(classList_=['A_I'])
            ])
            
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewINumber(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                AutoIncrement,
                defaultValue
            ])
        }

        case "DOUBLE" : {
            let AutoIncrement = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="AutoIncrement"),
                NewCheckBox(classList_=['A_I'])
            ])
            
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewINumber(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                AutoIncrement,
                defaultValue
            ])
        }

        case "DECIMAL" : {
            let AutoIncrement = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="AutoIncrement"),
                NewCheckBox(classList_=['A_I'])
            ])
            
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewINumber(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                AutoIncrement,
                defaultValue
            ])
        }
        
        case "DATE" : {
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewInput(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                defaultValue
            ])
        }

        case "BOOLEAN" : {
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewInput(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                defaultValue
            ])
        }

        case "REAL" : {
            let AutoIncrement = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="AutoIncrement"),
                NewCheckBox(classList_=['A_I'])
            ])
            
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewINumber(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                AutoIncrement,
                defaultValue
            ])
        }

        case "STRING" : {
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewInput(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                defaultValue
            ])
        }

        case "TEXT" : {
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewTextArea(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                defaultValue
            ])
        }

        case "CHAR" : {
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewINumber(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                defaultValue
            ])
        }

        case "JSON" : {
            let defaultValue = NewDiv(classList_=['flex'],Childs=[
                NewSpan(text="defaultValue"),
                NewInput(classList_=['D_V'])
            ])

            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
                defaultValue
            ])
        }

        case "BLOB" : {
            return NewDiv(classList_=[],Childs=[
                PkDiv,
                notNull,
            ])
        }
    }
    return null

}

function GenNewAssociation() {
    let models = document.querySelector('.ModelsList').querySelector('ul').querySelectorAll('li')
    let options = []
    
    for(let model of models) {
        let option = NewOption([],[],model.querySelector('.Mname').textContent)
        options.push(option)
    }

    let li = document.createElement('li')
    li.appendChild(NewDiv(['Association'],[
        NewDiv(['flex'],[
            NewDiv([],[
                NewSelect([],[
                    NewOption([],[],"1:1"),
                    NewOption([],[],"1:M"),
                    NewOption([],[],"M:N")
                ]),
                NewSpan("To:"),
                NewSelect([],options)
            ]),
            NewDiv([],[
                NewButton([],[
                    NewImg([],[],"https://img.icons8.com/nolan/64/delete-sign.png")
                ],action = {event:"click",function:delAssociation})
            ])
        ])
    ]))
    return li
}