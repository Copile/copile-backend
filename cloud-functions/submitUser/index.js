// gcp cli command to deploy:
// gcloud functions deploy backend --runtime nodejs14 --trigger-http --allow-unauthenticated --source backend



// const functions = require("@google-cloud/functions-framework");
const { Datastore } = require("@google-cloud/datastore");

const datastore = new Datastore();

const request = require("request");
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));

const error = (res, code, message) => {
    return res.status(code).send(JSON.stringify({
        status: code,
        error: message,
    }));
}


class DatastoreObject {
    constructor (kind, template) {
        this.kind = kind;
        this.template = template;
    }

    _uuid () {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    _templateProcess (data) {
        // if this.template exists, and a key is missing from data, add it
        if(this.template) {
            for(const key in this.template) {
                if(!data[key]) {
                    data[key] = this.template[key];
                }
            }
        }
        return data;
    }

    async create (data) {
        data.uuid = this._uuid();
        const key = datastore.key([this.kind, data.uuid]);
        data = this._templateProcess(data);
        await datastore.save({ key, data });
        return data;
    }

    async update (id, data) {
        const key = datastore.key([this.kind, id]);
        await datastore.update({ key, data });
        // return new data
        return await this.get(id);
    }

    async delete (id) {
        const key = datastore.key([this.kind, id]);
        await datastore.delete(key);
        return true;
    }

    async get (id) {
        const key = datastore.key([this.kind, id]);
        const [entity] = await datastore.get(key);
        if(entity) return entity;
        return false;
    }

    async getByProperty (property, value) {
        const query = datastore.createQuery(this.kind).filter(property, "=", value);
        const [entities] = await datastore.runQuery(query);
        if(entities.length > 0) return entities[0];
        return false;
    }
}

class UserObject extends DatastoreObject {
    constructor (template) {
        super("User", template);
    }
}

class ActionObject extends DatastoreObject {
    constructor (template) {
        super("Action", template);
    }
}

const _types = {
    User: {
        userRole: "user",
        userData: {
            exchanges: {
                "binance": {
                    "apiKey": "",
                    "apiSecret": "",
                },
                "bybit": {
                    "apiKey": "",
                    "apiSecret": "",
                },
                "kucoin": {
                    "apiKey": "",
                    "apiSecret": "",
                }
            }
        }
    },
    Action: {
        "logs": [],
    }
}
const userObject = new UserObject(_types.User);
const actionObject = new ActionObject(_types.Action);

const api = {
    user: userObject,
    action: actionObject
}


// # region /api/user
app.get("/api/user/:uuid", async (req, res) => {
    const user = await api.user.get(req.params.uuid);
    if(!user) return error(res, 404, "User not found");
    return res.send(JSON.stringify({ status: 200, user }));
});
app.get("/api/user/:uuid/logs", async (req, res) => {
    const User = req.params.uuid;
    const user = await api.user.get(User);
    if(!user) return error(res, 404, "User not found");

});
app.post("/api/user/:uuid/update", async (req, res) => {
    const User = req.params.uuid;
    let user = await api.user.get(User);
    if(!user) return error(res, 404, "User not found");
    user = await api.user.update(User, req.body);
    return res.send(JSON.stringify({ status: 200, user: updatedUser }));
});
// #endregion


// #region /api/action
app.get("/api/action/:uuid", async (req, res) => {
    const action = await api.action.get(req.params.uuid);
    if(!action) return error(res, 404, "Action not found");
    return res.send(JSON.stringify({ status: 200, action }));
});
app.post("/api/action/submit", async (req, res) => {
    const action = await api.action.create(req.body);
    return res.send(JSON.stringify({ status: 200, action }));
});
app.delete("/api/action/:uuid/cancel", async (req, res) => {
    const action = await api.action.get(req.params.uuid);
    if(!action) return error(res, 404, "Action not found");
    await api.action.cancel(req.params.uuid);
    return res.send(JSON.stringify({ status: 200 }));
});
app.post("/api/action/:uuid/update", async (req, res) => {
    const Action = req.params.uuid;
    let action = await api.action.get(Action);
    if(!action) return error(res, 404, "Action not found");
    action = await api.action.update(Action, req.body);
    return res.send(JSON.stringify({ status: 200, action: updatedAction }));
});
// #endregion




app.post("/api/login", async (req, res) => {
    const oauthID = req.body.oauthID;
    const oauthAccessToken = req.body.oauthAccessToken;

    if(!oauthID || !oauthAccessToken) {
        return error(res, 400, "Missing oauthID");
    }

    const oauthTokenValid = await new Promise(r => {
        request.get(`https://discordapp.com/api/users/@me`, {
            headers: {
                Authorization: `Bearer ${oauthAccessToken}`,
            },
        }, (err, response, body) => {
            if(err) return r("error");
            if(!response || !response.statusCode) return r("no response");
            if(response.statusCode !== 200) return r(response.statusCode.toString());
            return r(true);
        });
    });
    
    if(!oauthTokenValid) {
        return error(res, 401, ("Invalid discord token: " + oauthTokenValid));
    }

    let user = await api.user.getByProperty("oauthID", oauthID);
    if(!user) user = await api.user.create({
        oauthID: oauthID,
        oauthAccessToken: oauthAccessToken
    });

    return res.status(200).send(JSON.stringify({
        status: 200,
        user: user,
    }));
});


app.get("*", (req, res) => {
    return res.status(400).send("Not Authorized");
});


// expose the express app as a cloud function
module.exports = {
    app
}