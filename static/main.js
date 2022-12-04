
var queueFetch;
var waitUUID;
var imgUUID;
var waitProcessUUID;
var processedUUID;
var imgParams;
var processedParams;
var fetchCount = 0;
var uploadSizeLimit = 50000000;
remainingCards = [];
if (!localStorage.getItem("by")){
    localStorage.setItem("by",'anonymous')
}else{
    $('#by').val(localStorage.getItem("by"))
}


var localAlbum = JSON.parse(localStorage.getItem("localAlbum"));
if (!localAlbum){localAlbum={ID:'localAlbum',images:[],description:'My Images'}};
localStorage.setItem("localAlbum",JSON.stringify(localAlbum));

var myAlbums = JSON.parse(localStorage.getItem("myAlbums"));
if (!myAlbums){
    myAlbums=new Map(Object.entries({localAlbum:{ID: 'localAlbum', key: 'localAlbum'}}))
    localStorage.setItem("myAlbums",JSON.stringify(Object.fromEntries(myAlbums)));
}else{
    myAlbums = new Map(Object.entries(myAlbums));
}
var workingAlbum = localAlbum

if (workingAlbum.description){
    $('#album_description').val(workingAlbum.description)
}

if (workingAlbum.nickname){
    $('#nickname').val(workingAlbum.nickname)
}


$('#album_view').hide()
// upload function from JohannesAndersson's and Mosh Feu's answer to  https://stackoverflow.com/questions/2320069/jquery-ajax-file-upload
var Upload = function (file) {
    this.file = file;
};
Upload.prototype.getType = function() {return this.file.type;};
Upload.prototype.getSize = function() {return this.file.size;};
Upload.prototype.getName = function() {return this.file.name;};
Upload.prototype.doUpload = function () {
    var that = this;
    var formData = new FormData();
    // add assoc key values, this will be posts values
    formData.append("file", this.file, this.getName());
    formData.append("upload_file", true);
    $.ajax({
        type: "POST",
        url: "upload",
        xhr: function () {
            var myXhr = $.ajaxSettings.xhr();
            if (myXhr.upload) {
                myXhr.upload.addEventListener('progress', that.progressHandling, false);
            }
            return myXhr;
        },
        success: function (data) {
            // your callback here
            $("#Source_Image").attr("src",'image/'+data['UUID']+"?time="+new Date().getTime());
            imgUUID = data['UUID'];
            $('#imageUUID').html("Image UUID :       "+data['UUID']);
            $('#queue_pos').html("Position In Queue: Loaded Image!");
            imgParams = JSON.parse(data['params']);
            addImageToAlbum(imgUUID,imgParams);
            formGallery();
            updateInfo();
            $('#Process_div').show(); 
            $('#queue_pos_display_process').show()
        },
        error: function (error) {
            // handle error
            console.log(error)
            alert("While uploading images, the following error is encountered "+error)
        },
        async: false,
        data: formData,
        cache: false,
        contentType: false,
        processData: false,
        timeout: 300000
    });
};
Upload.prototype.progressHandling = function (event) {
    var percent = 0;
    var position = event.loaded || event.position;
    var total = event.total;
    var progress_bar_id = "#progress-wrp";
    if (event.lengthComputable) {
        percent = Math.ceil(position / total * 100);
    }
    // update progressbars classes so it fits your code
    $(progress_bar_id + " .progress-bar").css("width", +percent + "%");
    $(progress_bar_id + " .status").text(percent + "%");
};




$(document).ready( function () {

    queueCheck()
    $('#server_queue_display').hide()
    $('#Process_div').hide(); 
    $('#Final_Image_View').hide()
    $('#queue_pos_display_process').hide()
    $('#stop_queue').hide() 
    

    // Section for handling loading of image
    $('#generate').on( "submit", function(e){
        console.log('Generating results using');
        var ele = document.getElementsByName('sampler_gen');
        for(i = 0; i < ele.length; i++) {
            if(ele[i].checked)
            sampler_gen = ele[i].value;
        }
        
        var genDic = {
            prompt:$('#positive_prompt_gen').val(),
            negative_prompt:$('#negative_prompt_gen').val(),
            ratio:$('#ratio').val(),
            sampler_index: sampler_gen,
            seed:$('#seed_gen').val(),
            step_delta:$('#step_delta').val()
        };
        console.log(genDic);
        $.ajax({
            type: "POST",
            url: "new",
            data: JSON.stringify(genDic),
            success: function(data) {
                console.log('Response image UUID:');
                console.log(data);
                waitUUID = data['UUID']
                $('#imageUUID').html("Image UUID :       "+waitUUID);
                $('#queue_pos').html("Position In Queue: "+data['Queue']);
                $("#Source_Image").attr("src",'static/please_wait_until_your_image.webp');  
                $('#Load_Image').hide();   
                $('#Process_div').hide();     
                $('#info_display').html(''); 
                console.log('Start Fetching Queue!');
                fetchCount = 0
                if (!queueFetch){queueFetch = setInterval(queueCheck, 1000);};
                $('#server_queue_display').show()
            },
            error:function(error) {
                console.log(error.responseJSON);
                alert(JSON.stringify(error.responseJSON))
            },
            contentType: 'application/json; charset=utf-8',
            dataType: 'json'
        });
        e.preventDefault();
    });

    $('#load_from_server').on( "submit", function(e){
        
        var uuidReq = $('#load_uuid').val();
        loadImage(uuidReq);
        e.preventDefault();
    });

    $('#generate_like').on( "submit", function(e){
        var uuidReq = $('#like_uuid').val();
        generateLike(uuidReq);
        e.preventDefault();
    });

    $('#myfile').on( "change", function(e){
        myArray = Array.from($('#myfile')[0].files);
        myArray.sort(function(a,b) {
            return String.naturalCompare(a.name, b.name)
        });
        for (let i = 0; i < myArray.length; i++) {
            var file = myArray[i];
            console.log(file)
            if (file){
                console.log('Image upload!');
                var upload = new Upload(file);

                // maby check size or type here with upload.getSize() and upload.getType()
                console.log('Size: '+upload.getSize())
                console.log('Type: '+upload.getType())
                if (upload.getSize() > uploadSizeLimit) {
                    alert('File too big!')
                    $("#myfile").replaceWith($("#myfile").val('').clone(true))
                }else if(upload.getType()=='image/png'||upload.getType()=='image/jpeg'||upload.getType()=='image/webp'){
                    // execute upload
                    console.log('uploading image '+ file.name);
                    upload.doUpload();
                }else{
                    alert('Only jpegs, pngs and webps are allowed!')
                    $("#myfile").replaceWith($("#myfile").val('').clone(true))
                }
            }
        }
        e.preventDefault();
    });

    $('#stop_queue').click( function(e){
        console.log('Stop Fetching Queue!');
        clearInterval(queueFetch);
        queueFetch = null;
        $('#server_queue_display').hide()
    });

    $('#start_queue').click( function(e){
        console.log('Start Fetching Queue!');
        fetchCount = 0
        if (!queueFetch){queueFetch = setInterval(queueCheck, 1000);};
        $('#server_queue_display').show()
    });

    $('#info_button').click( function(e){
        if (imgUUID){
            console.log('Getting info about pic above!');
            $.getJSON( "get_info/"+imgUUID, function( data ) {
                imgParams = data;
                updateInfo();
            }).fail(function(error) {
                console.log(error.responseJSON);
                alert(JSON.stringify(error.responseJSON))
            });
        }
    });

    $('#processed_info_button').click( function(e){
        if (processedUUID){
            console.log('Getting info about processed pic above!');
            $.getJSON( "get_info/"+processedUUID, function( data ) {
                processedParams = data;
                updateInfo();
            }).fail(function(error) {
                console.log(error.responseJSON);
                alert(JSON.stringify(error.responseJSON))
            });
        }
    });

    $('#process').on( "submit", function(e){
        processImage(regen=false)
        e.preventDefault();
    });

    $('#reload_source').click( function(e){
        document.getElementById("Source_Image").src='image/'+imgUUID+"?time="+new Date().getTime();
    });
    
    $('#reload_processed').click( function(e){
        document.getElementById("Processed_Image").src='image/'+processedUUID+"?time="+new Date().getTime();
    });

    $('#Discard_and_get_new').click( function(e){
        console.log('Trying to get a new one!');
        processImage(regen=true)
    });

    $('#Download_processed').click( function(e){
        console.log('Downloading processed image!');
        // var link = $("<a href='image/"+processedUUID+" download'></a>");
        // var link = $("<a download></a>");
        // // link.attr("herf",'image/'+processedUUID); 
        // link.attr("herf",'static/no_such_image.webp'); 
        // $(document).append(link)
        // link.click();


        var link = document.createElement('a');
        link.href = 'image/'+processedUUID;
        link.download = '';
        link.click();
        link.remove();
    });

    $('#Send_to_be_processed').click( function(e){
        console.log('Send to above');
        imgUUID = processedUUID;
        processedUUID = null;
        $.getJSON( "get_info/"+imgUUID, function( infodata ) {
            imgParams = infodata;
            updateInfo();
        }).fail(function(error) {
            console.log(error.responseJSON);
            alert(JSON.stringify(error.responseJSON))
        });
        $('#queue_pos').html("Position In Queue: Loaded Image!");
        $('#imageUUID').html("Image UUID :       "+imgUUID);
        $("#Source_Image").attr("src",'image/'+imgUUID+"?time="+new Date().getTime()); 
        $('#Load_Image').show();
        $('#Process_div').show(); 
        $('#queue_pos_display_process').show()
        console.log('Stop Fetching Queue!');
        clearInterval(queueFetch);
        queueFetch = null;
        $('#server_queue_display').hide()

        $('#queue_pos_process').html("Position In Queue:     Press Generate First!");
        $('#processUUID').html("Processed Image UUID : Press Generate First!");
        $("#Processed_Image").attr("src",'static/source_image_placeholder.webp'); 
        $('#Final_Image_View').hide()
        $('#Discard_and_get_new').hide()
        
        $('#Download_processed').hide()
        // $('#download_process_link').attr("herf",'image/'+processedUUID);
        $('#Send_to_be_processed').hide()
    });

    formGallery();

    $('#clear_album').click( function(e){
        console.log('Clear gallery?');
        if (confirm("Are you sure you want to delete all images in this album? Note: we do not store images locally, only their UUIDs so no need to delete for disk space reasons.") == true) {
            workingAlbum.images = []
            localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
            formGallery();
        }
    });

    $('#export_album').click( function(e){
        console.log('export gallery');
        workingAlbum.by = $('#by').val();
        $.ajax({
            type: "POST",
            url: "save_album",
            data: JSON.stringify(workingAlbum),
            success: function(data) {
                console.log('Response album UUID:');
                console.log(data);
                myAlbums.set(data.ID,data);
                //sconsole.log(myAlbums)
                localStorage.setItem("myAlbums",JSON.stringify(Object.fromEntries(myAlbums)));
                localStorage.setItem(data.ID,JSON.stringify(workingAlbum));
                alert('Your album is saved! Its\' Share Key is\n'+data.ID+'\nAnd its\' Edit Key is\n'+data.key+'\nYou will be able to save this information as a local file later!');
                formAlbumList();
            },
            error:function(error) {
                console.log(error.responseJSON);
                alert(JSON.stringify(error.responseJSON))
            },
            contentType: 'application/json; charset=utf-8',
            dataType: 'json'
        });
    });
    $('#reverse_album').click( function(e){
        console.log('reverse album order!')
        workingAlbum.images.reverse();
        localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
        formGallery();
    });



    formAlbumList();
    
    $('#working_album').on( "submit", function(e){
        if ($('#album_key_in').val()){
            $.getJSON( "get_album_id/"+$('#album_key_in').val(), function( id ) {
                myAlbums.set(id.ID,{'ID':id.ID,'key':$('#album_key_in').val()});
                localStorage.setItem("myAlbums",JSON.stringify(Object.fromEntries(myAlbums)));
                console.log('Loading Album '+id.ID)
                loadAlbum(id.ID);
            }).fail(function(error) {
                console.log(error.responseJSON);
                alert(JSON.stringify(error.responseJSON));
            });
        }else{
            console.log('Loading Album '+$('#album_key').val())
            loadAlbum($('#album_key').val());
        }
        e.preventDefault();
    });

    $('#by').on( "change", function(e){
        localStorage.setItem("by", $('#by').val());
        e.preventDefault();
    });

    $('#album_description').on( "change", function(e){
        if ($('#album_description').val()){
            workingAlbum.description = $('#album_description').val();
        }else{
            workingAlbum.description = 'My Album';
        }
        
        localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
        e.preventDefault();
    });

    $('#nickname').on( "change", function(e){
        if ($('#nickname').val()){
            workingAlbum.nickname = $('#nickname').val();
        }else{
            workingAlbum.nickname = 'My Album';
        }
        localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
        e.preventDefault();
    });


    $(window).scroll(function () {
        // End of the document reached?
            if ($(document).height() - $(this).height() - 1920 < $(this).scrollTop()) {    
                console.log('Loading new images');
                if (remainingCards.length > 0){
                    $('#cards').append(remainingCards.shift())
                }
                
            }
        }); 

});



function loadImage(uuidReq){
    console.log('Load image using');
    console.log(uuidReq);
    $("#Source_Image").attr("src",'image/'+uuidReq+"?time="+new Date().getTime());
    imgUUID = uuidReq;
    $('#imageUUID').html("Image UUID :       "+imgUUID);
    $('#queue_pos').html("Position In Queue: Loaded Image!");
    console.log('Getting info about pic above!');
    $.getJSON( "get_info/"+imgUUID, function( data ) {
        imgParams = data;
        updateInfo();
        if (!workingAlbum.images.includes(imgParams)){
            addImageToAlbum(imgUUID,imgParams);
        }
        formGallery();
        $('#Process_div').show(); 
        $('#queue_pos_display_process').show()
    }).fail(function(error) {
        console.log(error.responseJSON);
        alert(JSON.stringify(error.responseJSON))
    });
}

function generateLike(uuidReq){
    console.log('Generate image like');
    console.log(uuidReq);
    // $("#Source_Image").attr("src",'image/'+uuidReq);
    $.getJSON( "new_like/"+uuidReq, function( data ) {
        console.log('Response image UUID:');
        console.log(data);
        waitUUID = data['UUID']
        $('#imageUUID').html("Image UUID :       "+waitUUID);
        $('#queue_pos').html("Position In Queue: "+data['Queue']);
        $("#Source_Image").attr("src",'static/please_wait_until_your_image.webp');  
        $('#Load_Image').hide();  
        $('#Process_div').hide();    
        $('#info_display').html('');   
        console.log('Start Fetching Queue!');
        fetchCount = 0
        if (!queueFetch){queueFetch = setInterval(queueCheck, 1000);};
        $('#server_queue_display').show()
    }).fail(function(error) {
    console.log(error.responseJSON);
    alert(JSON.stringify(error.responseJSON))
    });
}

function updateInfo(){
    console.log(JSON.stringify(imgParams, null, 2));
    $('#info_display').html(JSON.stringify(imgParams, null, 2));
    if (!$.isEmptyObject(imgParams)){
        if ('prompt' in imgParams){
            $('#positive_prompt_process').val(imgParams['prompt']);
        };
        if ('negative_prompt' in imgParams){
            $('#negative_prompt_process').val(imgParams['negative_prompt']);
        };
        
    }
    $('#processed_info_display').html(JSON.stringify(processedParams, null, 2));
}

var previous_response_string = ''
function queueCheck(){
    fetchCount = fetchCount + 1;
    $.getJSON( "get_queue", function( data ) {
        var currentString = JSON.stringify(data);
        if (previous_response_string != currentString || fetchCount == 1){
            
            console.log('Server Queue changed:');
            console.log(data);
            previous_response_string = currentString;
            setTimeout(function(){    console.log('Waiting for server');},500);
            $('#queue_content').html('');
            var counter = 0;
            var myJobInQueue = false;
            var processJobInQueue = false;
            for (const key in data){
                // console.log(key);
                // console.log(data[key]);
                counter++;
                if (key == waitUUID){
                    myJobInQueue = true;
                    $('#queue_pos').html("Position In Queue: "+counter);
                }
                if (key == waitProcessUUID){
                    processJobInQueue = true;
                    $('#queue_pos_process').html("Position In Queue:     "+counter);
                }
                $('#queue_content').append("<tr><th>"+counter+"</th><th>"+key+"</th></tr>")
            }
            if (!myJobInQueue && waitUUID){
                console.log("My job "+waitUUID+" is porbably done! updating view!")
                imgUUID = waitUUID;
                waitUUID = '';
                $('#queue_pos').html("Position In Queue: Loaded Image!");
                $('#imageUUID').html("Image UUID :       "+imgUUID);
                $("#Source_Image").attr("src",'image/'+imgUUID+"?time="+new Date().getTime()); 
                $.getJSON( "get_info/"+imgUUID, function( data ) {
                    imgParams = data;
                    updateInfo();
                    addImageToAlbum(imgUUID,imgParams);
                    formGallery();
                    $('#Process_div').show(); 
                    $('#queue_pos_display_process').show()
                }).fail(function(error) {
                    console.log(error.responseJSON);
                    alert(JSON.stringify(error.responseJSON))
                });
                $('#Load_Image').show();
                $('#Process_div').show(); 
                $('#queue_pos_display_process').show()
                console.log('Stop Fetching Queue!');
                clearInterval(queueFetch);
                queueFetch = null;
                $('#server_queue_display').hide()
            }
            if (!processJobInQueue && waitProcessUUID){
                console.log("Process job "+waitProcessUUID+" is porbably done! updating view!")
                processedUUID = waitProcessUUID;
                waitProcessUUID = '';
                $('#queue_pos_process').html("Position In Queue:     Loaded Image!");
                $('#processUUID').html("Processed Image UUID : "+processedUUID);
                $("#Processed_Image").attr("src",'image/'+processedUUID+"?time="+new Date().getTime()); 
                $.getJSON( "get_info/"+processedUUID, function( data ) {
                    processedParams = data;
                    updateInfo();
                    addImageToAlbum(processedUUID,processedParams);
                    formGallery();
                }).fail(function(error) {
                    console.log(error.responseJSON);
                    alert(JSON.stringify(error.responseJSON))
                });
                $('#Load_Image').show();
                $('#Process_div').show(); 
                $('#Final_Image_View').show()
                $('#Discard_and_get_new').show()
                
                $('#Download_processed').show()
                // $('#download_process_link').attr("herf",'image/'+processedUUID);
                $('#Send_to_be_processed').show()
                console.log('Stop Fetching Queue!');
                clearInterval(queueFetch);
                queueFetch = null;
                $('#server_queue_display').hide()
            }
        };
    });
    if (fetchCount > 60){
        console.log('Stop Fetching Queue!');
        clearInterval(queueFetch);
        queueFetch = null;
        $('#server_queue_display').hide()
    }
} 

function processImage(regen){
    console.log('Processing results using');
        var ele = document.getElementsByName('sampler_process');
        for(i = 0; i < ele.length; i++) {
            if(ele[i].checked)
            sampler_process = ele[i].value;
        }
        
        var processDic = {
            prompt:$('#positive_prompt_process').val(),
            negative_prompt:$('#negative_prompt_process').val(),
            denoise_strength_delta:$('#denoise_strength_delta').val(),
            sampler_index: sampler_process,
            seed:$('#seed_process').val(),
            step_delta:$('#step_delta_process').val(),
            source_uuid:imgUUID
        };
        if (regen&&processedUUID) {processDic['replace_uuid'] = processedUUID};

        console.log(processDic);
        $.ajax({
            type: "POST",
            url: "diffuse",
            data: JSON.stringify(processDic),
            success: function(data) {
                console.log('Response image UUID:');
                console.log(data);
                waitProcessUUID = data['UUID']
                $('#processUUID').html("Processed Image UUID : "+waitProcessUUID);
                $('#queue_pos_process').html("Position In Queue:     "+data['Queue']);
                $("#Processed_Image").attr("src",'static/please_wait_until_your_image.webp');   
                $('#Process_div').hide();    
                $('#Discard_and_get_new').hide()
                $('#Download_processed').hide()
                $('#Send_to_be_processed').hide()
                $('#info_display').html(''); 
                $('#Final_Image_View').show()
                console.log('Start Fetching Queue!');
                fetchCount = 0
                if (!queueFetch){queueFetch = setInterval(queueCheck, 1000);};
                $('#server_queue_display').show()
            },
            error:function(error) {
                console.log(error.responseJSON);
                alert(JSON.stringify(error.responseJSON))
            },
            contentType: 'application/json; charset=utf-8',
            dataType: 'json'
        });
}


function formGallery(){
    var count = 0
    var cards = $("<div class='cards' id='cards'></dev>");
    remainingCards = []
    for (let idx in workingAlbum.images){
        let crtIdx = workingAlbum.images.length-idx-1;
        let UUID = workingAlbum.images[crtIdx];
        //console.log(UUID);
        var card = $("<div class='card' id='"+UUID+"'></div>");

        card.append($("<h3>"+UUID+"<h3/>"));
        card.append($("<img loading='lazy' src='image/"+UUID+"'/>"));
        card.append($("<br/>"));

        if (!localStorage.getItem(UUID)){
            $.getJSON( "get_info/"+UUID, function( data ) {
                localStorage.setItem(UUID, JSON.stringify(data));
            }).fail(function(error) {
                console.log(error.responseJSON);
                alert(JSON.stringify(error.responseJSON))
            });
        }
        let info = localStorage.getItem(UUID)
        if (info != '{}'){
            card.append($('<pre class="info"></pre>').html(JSON.stringify(JSON.parse(info), null, 2)));
        }
        
        var deleteButton = $('<button type="button" >Delete '+UUID+'</button>');
        deleteButton.click(function(){
            deleteImageFromGallery(crtIdx,UUID);
        });
        card.append(deleteButton);
        card.append($("<br/>"));

        var generateLikeButton = $('<button type="button" >Generate Image Like '+UUID+'</button>');
        generateLikeButton.click(function(){
            generateLike(UUID);
        });
        card.append(generateLikeButton);
        card.append($("<br/>"));

        var loadButton = $('<button type="button" >Load Image '+UUID+' for processing</button>');
        loadButton.click(function(){
            loadImage(UUID);
        });
        card.append(loadButton);
        card.append($("<br/>"));

        var moveUpButton = $('<button type="button" >Move Image Up</button>');
        moveUpButton.click(function(){
            // we will actually move down as when displaying, the array is reversed
            if (crtIdx + 1 < workingAlbum.images.length){
                console.log('Move Image Up');
                [workingAlbum.images[crtIdx], workingAlbum.images[crtIdx+1]] = [workingAlbum.images[crtIdx+1], workingAlbum.images[crtIdx]]
                localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
                formGallery();
            } 
        });
        card.append(moveUpButton);
        card.append($("<br/>"));

        var moveDownButton = $('<button type="button" >Move Image Down</button>');
        moveDownButton.click(function(){
            // we will actually move up as when displaying, the array is reversed
            if (crtIdx - 1 > -1){
                console.log('Move Image Down');
                [workingAlbum.images[crtIdx-1], workingAlbum.images[crtIdx]] = [workingAlbum.images[crtIdx], workingAlbum.images[crtIdx-1]]
                localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
                formGallery();
            } 
        });
        card.append(moveDownButton);
        card.append($("<br/>"));

        remainingCards.push(card);
        count++;
    }
    if (count == 0){
        $("#album_view").html('<div id = "no_result">No images in local storage.</div>');
    }else{
        for (let i = 0; i < 3; i++) {
            if (remainingCards.length > 0){
                cards.append(remainingCards.shift())
            }
        }
        $("#album_view").html('');
        $("#album_view").append(cards);
    }
    $('#album_view').show();
}

function deleteImageFromGallery(idx,UUID){
    console.log('removing idx '+idx);
    console.log('removing UUID '+UUID);
    workingAlbum.images.splice(idx, 1);
    localStorage.removeItem(UUID);
    localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
    formGallery();
};

function loadAlbum(id){
    if (id!='localAlbum'){
        $.getJSON( "album_json/"+id, function( data ) {
            console.log('The album requested is:');
            console.log(data);
            workingAlbum = data;
            workingAlbum.key = myAlbums.get(id).key
            localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
            $('#album_name').html('Working On Album '+id);
            if ("nickname" in workingAlbum){
                $('#nickname').val(workingAlbum.nickname);
            }
            if ("by" in workingAlbum){
                $('#by').val(workingAlbum.by);
            }
            if ("description" in workingAlbum){
                $('#album_description').val(workingAlbum.description);
            }
            formGallery();
        }).fail(function(error) {
            console.log(error.responseJSON);
            alert(JSON.stringify(error.responseJSON))
        });
    }else{
        workingAlbum = JSON.parse(localStorage.getItem('localAlbum'))
        $('#album_name').html('Working On Album '+id);
        if ("nickname" in workingAlbum){
            $('#nickname').val(workingAlbum.nickname);
        }
        if ("by" in workingAlbum){
            $('#by').val(workingAlbum.by);
        }
        if ("description" in workingAlbum){
            $('#album_description').val(workingAlbum.description);
        }
        formGallery();
    }


}

function addImageToAlbum(imgUUID,imgParams){
    localStorage.setItem(imgUUID, JSON.stringify(imgParams));
    if (!workingAlbum.images.includes(imgUUID)){
        workingAlbum.images.push(imgUUID);
        localStorage.setItem(workingAlbum.ID, JSON.stringify(workingAlbum));
    }
}

function formAlbumList(){
    $('#album_key').html('');
    myAlbums.forEach (function(data, ID) {
        // <option value="volvo">Volvo</option>
        if (data.nickname){
            $('#album_key').append($('<option value="'+ID+'">'+ID+':'+data.nickname+'</option>'));
        }else if(JSON.parse(localStorage.getItem(ID)).nickname){
            $('#album_key').append($('<option value="'+ID+'">'+ID+':'+JSON.parse(localStorage.getItem(ID)).nickname+'</option>'));
        }else{
            $('#album_key').append($('<option value="'+ID+'">'+ID+'</option>'));
        }
    })
}