
from xml.dom.pulldom import parseString
from flask import Flask, flash, redirect, render_template, request, session, abort, escape,jsonify
import os , requests, json, datetime


# def findArtist(text):
#     res = requests.get('https://api.artsy.net/api/search?q='+text+'&size=10',headers={'X-XAPP-Token': getToken()})
#     results = res.json()["_embedded"]["results"]
#     dic = {}
#     for result in results:
#         if result['og_type'] == 'artist':
#             id = result["_links"]["self"]["href"].rpartition('/')[2]
#             dic[id] = (result['title'],result["_links"]['thumbnail']["href"])
#             if dic[id][1] == "/assets/shared/missing_image.png":
#                 dic[id] =(result['title'],'/static/artsy_logo.svg')
#     return json.dumps(dic)

# def findArtistDetail(text):
#     res = requests.get('https://api.artsy.net/api/artists/'+text,headers={'X-XAPP-Token': getToken()})
#     results = res.json()
#     dic = {}
#     dic['name'] = results['name']
#     dic['birthday'] = results['birthday']
#     dic['deathday'] = results['deathday']
#     dic['nationality'] = results['nationality']
#     dic['biography'] = results['biography']
#     return json.dumps(dic)


def getImage(UUID):
    print("Retreiving Image "+UUID+"...")
    pass

def newLike(UUID):
    print("Generating a Image like "+UUID+"...")
    pass

def getInfo(UUID):
    print("Getting Image info about "+UUID+"...")
    pass

def newImage(args):
    print("Generating a Image using")
    print(args)
    pass

def diffuseImage(args):
    print("Generating Image"+args.UUID+" using")
    print(args)
    pass

def getUploadedImageUUID(original_file_name):
    print("Image stored as {IMAGE UUID HERE}")
    pass

def getQueue():
    pass

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
# If `entrypoint` is not defined in app.yaml, App Engine will look for an app
# called `app` in `main.py`.
app = Flask(__name__)

app.config['IMAGE_FOLDER'] = 'images'
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/image/<uuid:uuid>')
def get_image(uuid):
    print(uuid)
    return getImage(uuid)

@app.route('/new_like/<uuid:uuid>')
def new_like(uuid):
    print(uuid)
    return newLike(uuid)

@app.route('/get_info/<uuid:uuid>')
def get_info(uuid):
    print(uuid)
    return getInfo(uuid)

@app.route('/get_queue')
def get_queue():
    print('get_queue recieved')
    return getQueue()

@app.route('/new', methods=['POST'])
def new_image():
    print(request.args)
    return newImage(request.args)

@app.route('/diffuse', methods=['POST'])
def diffuse():
    print(request.args)
    return diffuseImage(request.args)

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        resp = jsonify({'message' : 'No file selected'})
        resp.status_code = 400
        return resp
    file = request.files['file']
    if file.filename == '':
        resp = jsonify({'message' : 'Empty file name'})
        resp.status_code = 400
        return resp
    if not file:
        resp = jsonify({'message' : 'Empty file'})
        resp.status_code = 400
        return resp
    if not allowed_file(file.filename):
        resp = jsonify({'message' : 'Illegal file extension'})
        resp.status_code = 400
        return resp
    filename = getUploadedImageUUID(file.filename)
    file.save(os.path.join(app.config['IMAGE_FOLDER'], filename))
    print('File saved to '+filename)
    resp = jsonify({'filename' : filename})
    resp.status_code = 201
    return resp

if __name__ == '__main__':
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. You
    # can configure startup instructions by adding `entrypoint` to app.yaml.
    app.run(host='127.0.0.1', port=19637, debug=True)
