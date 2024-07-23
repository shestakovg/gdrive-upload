const fs = require('fs');
const { google } = require('googleapis');
const apikeys = require('./apikeys.json');
const path = require("path");
const SCOPE = ['https://www.googleapis.com/auth/drive'];
const folder = '1rRR56mtuRT-PwQAe-nmf0VPbbsUFQ-kr';

// A Function that can provide access to google drive api
async function authorize() {
    const jwtClient = new google.auth.JWT(
        apikeys.client_email,
        null,
        apikeys.private_key,
        SCOPE
    );
    await jwtClient.authorize();
    return jwtClient;
}

function getFiles(dir, files_) {
    files_ = files_ || [];
    var files = fs.readdirSync(dir);
    for (var i in files) {
        var name = dir + files[i];
        if (!fs.statSync(name).isDirectory()) {
            files_.push(name);
        }
    }
    return files_;
}

async function enumerateFiles(authClient) {
    let fileDir = "";
    process.argv.forEach((value, index) => {
        if (index === 2) {
            fileDir = value;
        }
        //console.log(index, value);
    });

    getFiles(fileDir)
        .forEach(async x => await uploadFile(authClient, x));

    await listActiveSeries(authClient);
}

// A Function that will upload the desired file to google drive folder
async function uploadFile(authClient, fileName) {


    return new Promise((resolve, rejected) => {
        process.stdout.write('Program has been started');
        const drive = google.drive({ version: 'v3', auth: authClient });
        var fileMetaData = {
            name: path.basename(fileName),
            parents: [folder]
        }
        drive.files.create({
            resource: fileMetaData,
            media: {
                body: fs.createReadStream(fileName), // files that will get uploaded
                mimeType: 'text/plain'
            },
            fields: 'id'
        }, function(error, file) {
            if (error) {
                console.log(error);
                return rejected(error)
            }
            console.log(file);
            fs.unlinkSync(fileName);
            resolve(file);
        })
    });
}

async function listActiveSeries(authClient) {
    let _RESULT = null;
    try {
        let dateToDelete = new Date();
        dateToDelete.setDate(dateToDelete.getDate() - 5);

        console.log(dateToDelete.toISOString());

        const googleDriveClient = google.drive({ version: 'v3', auth: authClient });
        const date = dateToDelete.toISOString(); // '2024-07-17T23:00:00';

        const response = await googleDriveClient.files.list({
            pageSize: 150,
            q: `'${folder}' in parents and trashed=false and createdTime < '${date}'`
        });

        if (response && response.data && response.data.files) {
            _RESULT = response.data.files;

            _RESULT.forEach(x =>
                googleDriveClient.files.delete({ fileId: x.id })
                .then(
                    async function(response) {
                        //response.status(204).json({ status: 'success' });
                    },
                    function(err) {
                        return res
                            .status(400)
                            .json({ errors: [{ msg: 'Deletion Failed for some reason' }] });
                    }
                )
            );
        }
    } catch (ex) { console.log(ex); }

    console.log(_RESULT);
}

authorize()
    .then(enumerateFiles)
    .catch("error", console.error());