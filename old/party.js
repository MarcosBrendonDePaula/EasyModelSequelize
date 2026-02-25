module.exports = (http=>{
    const io = require('socket.io')(http);
    const Config = {
        Salas : [],
        Users : [],
        UserSala : {},
        Sala_position:{},
        ProcurarSala: (sala_,Lista_De_salas)=>{
            for(let i of Lista_De_salas) {
                if(i.id == sala_){
                    return i;
                }
            }
            return undefined;
        }
    }

    io.on("connection",async(client)=>{
        // ao entrar uma sala é criada
        client.on("CriarSala",async(msg)=>{
            let sala = {
                id : Math.floor(Math.random()*999999),
                Users : [client],
                Models : [],
            }
            
            console.log("Nova sala",sala.id)
            Config.Sala_position[sala.id] = Config.Salas.length
            Config.Salas.push(sala)
            Config.Users.push(client)
            Config.UserSala[client.id] = sala.id

            client.emit("sala_atual",{id:sala.id})

        })

        // retira o client da sala anterior e o coloca na nova sala
        client.on("EntrarSala",async(sala_)=>{
            if(Config.Salas[Config.Sala_position[sala_.id]]) {
                //removendo o usuario da sala atual
                let user_room = Config.UserSala[client.id]
                let sala = Config.Salas[Config.Sala_position[user_room]]
                
                if(sala) {
                    let newUsers = []
                    for(let user of sala.Users) {
                        if(user.id!=client.id)
                            newUsers.push(user)
                    }
                    //atualizando a sala
                    Config.Salas[Config.Sala_position[sala.id]].Users = newUsers
                }

                //adicionando o usuario a sala nova
                Config.UserSala[client.id] = sala_.id
                Config.Salas[Config.Sala_position[sala_.id]].Users.push(client)
                client.emit("Atualizar",Config.Salas[Config.Sala_position[sala_.id]].Models)
                client.emit("sala_atual",{id:sala_.id})
            } else {
                client.emit("err",{err_name:"sala não encontrada"})
            } 
        })


        client.on("Editar_Model",async(data)=>{
            
            let user_room = Config.UserSala[client.id]
            let sala = Config.Salas[Config.Sala_position[user_room]]

            let newModels = []
            for(let model of sala.Models) {
                if(model.name != data.name)
                    newModels.push(model)
                else
                    newModels.push(data)
            }
            Config.Salas[Config.Sala_position[user_room]].Models = newModels

            for( let user of Config.Salas[Config.Sala_position[user_room]].Users) {
                if(user.id != client.id) {
                    user.emit("Atuzlizar_Model",data);
                }
            }
        })
        
        client.on("NewModel",async(model_config)=>{
            let user_room = Config.UserSala[client.id]
            Config.Salas[Config.Sala_position[user_room]].Models.push(model_config)

            for( let user of Config.Salas[Config.Sala_position[user_room]].Users) {
                if(user.id != client.id) {
                    user.emit("addModel",model_config);
                }
            }
        })

        client.on("RemoverModel",async(data)=>{
            let user_room = Config.UserSala[client.id]
            let sala = Config.Salas[Config.Sala_position[user_room]]

            let newModels = []
            for(let model of sala.Models) {
                if(model.name != data.name)
                    newModels.push(model)
            }

            Config.Salas[Config.Sala_position[user_room]].Models = newModels

            for( let user of Config.Salas[Config.Sala_position[user_room]].Users) {
                if(user.id != client.id) {
                    user.emit("remover_model",data);
                }
            }
            
        })
    })

})

