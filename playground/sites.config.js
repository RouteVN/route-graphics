export default {
    functions:{
        escapeJson: (data)=>{
            return encodeURIComponent(JSON.stringify(data))
        }
    }
}