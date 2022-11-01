# !/usr/bin/python3
from xml.dom.pulldom import parseString
from flask import Flask, flash, redirect, render_template, send_file,request, session, abort, escape,jsonify
import os , requests, json, datetime, uuid,base64 , time,signal,io
from PIL import Image,PngImagePlugin
from threading import Thread


url = "http://127.0.0.1:7861"


# now we try to read the db stored
# we will store the image data to csv line by line additively
imageDic = {}
# NOTE: as python 3.7 and later preserve dictonary order, use a dictionary for ordered queue
queue = {}
with open('images.tsv', mode ='r',encoding='utf8')as file:
    line = file.readline()
    assert line.strip().startswith('UUID\tparameters'), "Data format error!"
    line = file.readline()
    while line:
        cache = line.strip().split('\t')
        imageDic[cache[0]] = json.loads(' '.join(cache[1:]))
        line = file.readline()

# clean
del line
del cache


# Utility Functions
def formDicFromString(inputString):
    print(inputString)
    denoising_strength = inputString.partition("Denoising strength:")[2].partition(',')[0]
    denoising_strength = denoising_strength if denoising_strength else '0.0'
    model_hash = inputString.partition("Model hash:")[2].partition(',')[0]
    size = inputString.partition("Size:")[2].partition(',')[0]
    width,null,height = size.strip(', \n').partition('x')
    seed = inputString.partition("Seed:")[2].partition(',')[0]
    cfg = inputString.partition("CFG scale:")[2].partition(',')[0]
    sampler = inputString.partition("Sampler:")[2].partition(',')[0]
    steps = inputString.partition("Steps:")[2].partition(',')[0]
    pos_prompt,null,neg_prompt = inputString.rpartition("Negative prompt:")
    neg_prompt = neg_prompt.rpartition("\n")[0]
    return {
        'prompt'            : pos_prompt.strip(', \n'),
        'negative_prompt'   : neg_prompt.strip(', \n'),
        'steps'             : int(steps.strip(', \n')),
        "sampler_index"     : sampler.strip(', \n'),
        "cfg_scale"         : float(cfg.strip(', \n')),
        "seed"              : int(seed.strip(', \n')),
        "width"             : int(width.strip(', \n')),
        "height"            : int(height.strip(', \n')),
        "model_hash"        : model_hash.strip(', \n'),
        "denoising_strength": float(denoising_strength.strip(', \n'))
    }


def findFileFromUUID(UUID):
    fileNames = ['static/'+UUID[:3]+'/'+UUID+'.'+file_extension for file_extension in ALLOWED_EXTENSIONS]
    for fileName in fileNames:
        if os.path.isfile(fileName):
            return fileName
    return ''

def getImageParamsFromFile(UUID):
    path = findFileFromUUID(UUID)
    if path == '':
        print('File with UUID of '+ UUID+ " is not found!")
        return {}
    if path.endswith('png'):
        with open(path, "rb") as image_file:
            bs64_str = base64.b64encode(image_file.read())
        payload = 'data:image/png;base64,'+bs64_str.decode()
        res = requests.post(url+'/sdapi/v1/png-info', json = {'image':payload}).json()['info']
        return formDicFromString(res)
    else:
        return {}

def storeImg(img,params,UUID):
    # img need to be a pil object
    if not os.path.isdir("static/"+UUID[:3]):
        os.makedirs("static/"+UUID[:3])
    pnginfo_data = PngImagePlugin.PngInfo()
    for k, v in params.items():
        pnginfo_data.add_text(k, str(v))
    img.save("static/"+UUID[:3]+'/'+UUID+'.png', pnginfo=pnginfo_data)
    params['denoising_strength'] = params['denoising_strength'] if params['denoising_strength'] else 0.0
    dic = {
        'prompt'            : params['prompt'].strip(', \n'),
        'negative_prompt'   : params['negative_prompt'].strip(', \n'),
        'steps'             : int(params['steps']),
        "sampler_index"     : params['sampler'].strip(', \n'),
        "cfg_scale"         : float(params['cfg_scale']),
        "seed"              : int(params['seed']),
        "width"             : int(params['width']),
        "height"            : int(params['height']),
        "model_hash"        : params['sd_model_hash'].strip(', \n'),
        "denoising_strength": float(params['denoising_strength'])
    }
    with open('images.tsv', mode ='a',encoding='utf8')as file:
        file.write(UUID+'\t'+json.dumps(dic)+'\n')
    imageDic[UUID] = dic

sample_params = {
        'prompt'            : '',
        'negative_prompt'   : '',
        'steps'             : 0,
        "sampler_index"     : '',
        "cfg_scale"         : 0,
        "seed"              : 0,
        "width"             : 0,
        "height"            : 0,
        "model_hash"        : 0,
        "denoising_strength": 0
    }

def generateImage(params):
    myUUID = str(uuid.uuid4())
    queue[myUUID] = params
    return myUUID

def imageIsBlack(img):
    return not img.getbbox()

# This is the main thread for processing the queue into images
def processor():
    while True:
        # print(len(queue))
        global stop_thread
        if stop_thread:
            break
        if len(queue) > 0:
            UUID = next(iter(queue))
            print('Job Aquired! Handling '+ UUID)
            res = requests.post(url+'/sdapi/v1/txt2img', json = queue[UUID])
            while not res.status_code == 200:
                print('Error in stable diffusion webui api side! retrying....')
                res = requests.post(url+'/sdapi/v1/txt2img', json = queue[UUID])
            img = res.json()["images"][0]
            info = json.loads(res.json()["info"])
            info['parameters'] = info['infotexts'][0].strip('\'')
            del info['infotexts']
            if img.startswith("data:image/png;base64,"):
                img = img[len("data:image/png;base64,"):]
            img = base64.decodebytes(img.encode())
            img = Image.open(io.BytesIO(img))
            if imageIsBlack(img):
                print('Black Image detected! Resampling!')
                continue
            else:
                del queue[UUID]
            storeImg(img,info,UUID)
            print('Job finished '+ UUID)
        time.sleep(1)



# response handlers
def getImage(UUID):
    print("Retreiving Image "+UUID+"...")
    if UUID in queue:
        return send_file('static/please_wait_until_your_image.webp')
    path = findFileFromUUID(UUID)
    if path == '':
        print('File with UUID of '+ UUID+ " is not found!")
        return send_file('static/no_such_image.webp')
    print(path)
    return send_file(path)

def newLike(UUID):
    print("Generating a Image like "+UUID+"...")
    if not UUID in imageDic:
        resp = jsonify({'error' : 'There is no such source image!'})
        resp.status_code = 400
        return resp
    if imageDic[UUID] == {} or imageDic[UUID]['sampler_index'] == '':
        resp = jsonify({'error' : 'Please Select an Image generated by Stable Diffusion (model e6e8e1fc is running) !'})
        resp.status_code = 400
        return resp
    justLikeDic = imageDic[UUID].copy()
    justLikeDic['seed'] = -1
    # res = requests.post(url+'/sdapi/v1/txt2img', json = justLikeDic)
    return json.dumps({'UUID':generateImage(justLikeDic),'Queue':len(queue)})

def getInfo(UUID):
    print("Getting Image info about "+UUID+"...")
    if UUID not in imageDic:
        info = json.dumps(getImageParamsFromFile(UUID))
        if info == '{}':
            resp = jsonify({'error' : UUID+ ' not found! or is not stable diffused png image!'})
            resp.status_code = 400
            return resp
        imageDic[UUID] = info
        return info
    if imageDic[UUID]:
        return imageDic[UUID]
    else:
        info = json.dumps(getImageParamsFromFile(UUID))
        imageDic[UUID] = info
        return info

def newImage(args):
    
    # print(args)
    try:
        params = dict(args)
        if 'sampler_index' not in params:
            params["sampler_index"] = 'DPM2 Karras'

        if "cfg_scale" not in params:
            params["cfg_scale"] = 11
        else:
            params["cfg_scale"] = float(params["cfg_scale"])

        if "seed" not in params:
            params["seed"] = -1
        else:
            params["seed"] = int(params["seed"])

        if 'negative_prompt' not in params:
            params['negative_prompt'] = 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'
        elif params['negative_prompt'] == 'no negative prompt':
            params['negative_prompt'] = ''
        else:
            params['negative_prompt'] += 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'
        
        if 'steps' not in params:
            if params["sampler_index"] == 'DPM2 Karras':
                params['steps'] = 32
            elif params["sampler_index"] == 'Euler a':
                params['steps'] = 38
            elif params["sampler_index"] == 'Euler':
                params['steps'] = 38
            elif params["sampler_index"] == 'LMS':
                params['steps'] = 65
            elif params["sampler_index"] == 'Heun':
                params['steps'] = 38
            elif params["sampler_index"] == 'DPM2':
                params['steps'] = 32
            elif params["sampler_index"] == 'DPM2 a':
                params['steps'] = 32
            elif params["sampler_index"] == 'DPM fast':
                params['steps'] = 50
            elif params["sampler_index"] == 'DPM adaptive':
                params['steps'] = 32
            elif params["sampler_index"] == 'LMS Karras':
                params['steps'] = 60
            elif params["sampler_index"] == 'DPM2 a Karras':
                params['steps'] = 32
            elif params["sampler_index"] == 'DDIM':
                params['steps'] = 70
            else:
                params['steps'] = 35
        else:
            params["steps"] = int(params["steps"])
            if params['steps'] > 50:
                params['steps'] = 50

        if 'step_delta' in params:
            params['step_delta'] = int(params['step_delta'])
            if params['step_delta'] > 50:
                params['step_delta'] = 50
            elif params['step_delta'] < -100:
                params['step_delta'] = -100
            params["steps"] += int(params["steps"] * params['step_delta'] / 100.0)
            if params["steps"] < 1:
                params["steps"] = 1
            del params['step_delta']

        params['width'] = 512
        params['height'] = 512
        if 'ratio' in params:
            params['ratio'] = int(params['ratio'])
            if params['ratio']> 0:
                params['width'] += params['ratio'] * 512
            else:
                params['height'] += (-params['ratio']) * 512
            del params['ratio']
        print("Generating a Image using")
        print(params)
        return json.dumps({'UUID':generateImage(params),'Queue':len(queue)})
    except:
        print('Wrong json!',args)
        resp = jsonify({'error' : 'Please transmit a compatible json Dictionary'})
        resp.status_code = 400
        return resp
    

def diffuseImage(args):
    print("Generating Image"+args.UUID+" using")
    print(args)
    pass

def getQueue():
    return json.dumps(queue)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS






# If `entrypoint` is not defined in app.yaml, App Engine will look for an app
# called `app` in `main.py`.
app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/image/<string:uuid>')
def get_image(uuid):
    print(uuid)
    return getImage(uuid)

@app.route('/new_like/<string:uuid>')
def new_like(uuid):
    print(uuid)
    return newLike(uuid)

@app.route('/get_info/<string:uuid>')
def get_info(uuid):
    print(uuid)
    return getInfo(uuid)

@app.route('/get_queue')
def get_queue():
    print('get_queue recieved')
    return getQueue()

@app.route('/new', methods=['POST'])
def new_image():
    content_type = request.headers.get('Content-Type')
    if content_type.startswith('application/json'):
        return newImage(request.json)
    else:
        resp = jsonify({'error' : 'Please transmit a compatible json Dictionary'})
        resp.status_code = 400
        return resp

@app.route('/diffuse', methods=['POST'])
def diffuse():
    print(request.form)
    return diffuseImage(request.form)

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        resp = jsonify({'error' : 'No file selected'})
        resp.status_code = 400
        return resp
    file = request.files['file']
    if file.filename == '':
        resp = jsonify({'error' : 'Empty file name'})
        resp.status_code = 400
        return resp
    if not file:
        resp = jsonify({'error' : 'Empty file'})
        resp.status_code = 400
        return resp
    if not allowed_file(file.filename):
        resp = jsonify({'error' : 'Illegal file extension'})
        resp.status_code = 400
        return resp
    myUUID = str(uuid.uuid4())
    if not os.path.isdir("static/"+myUUID[:3]):
        os.makedirs("static/"+myUUID[:3])
    file.save("static/"+myUUID[:3]+'/'+myUUID+'.'+file.filename.rpartition('.')[2])
    print('File saved as '+myUUID)
    params = json.dumps(getImageParamsFromFile(myUUID))
    with open('images.tsv', mode ='a',encoding='utf8')as file:
        file.write(myUUID+'\t'+params+'\n')
    imageDic[myUUID] = params
    resp = jsonify({'UUID' : myUUID,'params':params})
    resp.status_code = 201
    return resp





if __name__ == '__main__':
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. You
    # can configure startup instructions by adding `entrypoint` to app.yaml.
    stop_thread = False
    thread = Thread(target = processor)
    thread.start()
    app.run(host='127.0.0.1', port=19637, debug=True)
    stop_thread = True
    thread.join()
    print('thread exited!')