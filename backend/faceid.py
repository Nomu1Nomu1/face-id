from flask import Flask, jsonify, request, redirect
from flask_sqlalchemy import SQLAlchemy
import face_recognition
import numpy as np

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

app = Flask(__name__)
# Remove :password to connect my own sql
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root@localhost/db_face_recognition'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    encodings = db.relationship('FaceEncoding', backref='user', lazy=True)

class FaceEncoding(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    encoding = db.Column(db.PickleType, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

# Buat tabel dalam konteks aplikasi
with app.app_context():
    db.create_all()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/', methods=['GET', 'POST'])
def upload_image():
    return '''
    <!doctype html>
    <title>It Works</title>
    <h1>Face Recognition API</h1>
    '''

@app.route('/register', methods=['POST'])
def register_face():
    if 'file' not in request.files or 'name' not in request.form:
        return jsonify({"error": "Tidak ada file atau nama yang diunggah"}), 400

    file = request.files['file']
    name = request.form['name']

    if file.filename == '':
        return jsonify({"error": "Nama file kosong"}), 400

    if not name:
        return jsonify({"error": "Nama tidak disertakan"}), 400

    if file and allowed_file(file.filename):
        img = face_recognition.load_image_file(file)
        encodings = face_recognition.face_encodings(img)
        
        if len(encodings) > 0:
            user = User.query.filter_by(name=name).first()
            if not user:
                user = User(name=name)
                db.session.add(user)
                db.session.commit()

            for encoding in encodings:
                new_face_encoding = FaceEncoding(encoding=encoding, user_id=user.id)
                db.session.add(new_face_encoding)
            
            db.session.commit()
            return jsonify({"success": f"Encoding wajah untuk {name} telah didaftarkan"}), 201
        else:
            return jsonify({"error": "Tidak ada wajah yang terdeteksi di gambar"}), 400
    else:
        return jsonify({"error": "Format file tidak diizinkan"}), 400
    
@app.route('/find_face', methods=['POST'])
def find_face():
    if 'file' not in request.files:
        return jsonify({"error": "Tidak ada file yang diunggah"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "Nama file kosong"}), 400

    if file and allowed_file(file.filename):
        img = face_recognition.load_image_file(file)
        unknown_face_encodings = face_recognition.face_encodings(img)

        with app.app_context():
            users = User.query.all()
            known_face_encodings = []
            known_face_names = []

            for user in users:
                for face_encoding in user.encodings:
                    known_face_encodings.append(np.array(face_encoding.encoding))
                    known_face_names.append(user.name)

        face_found = False
        face_names = []

        if len(unknown_face_encodings) > 0:
            face_found = True
            for unknown_encoding in unknown_face_encodings:
                results = face_recognition.compare_faces(known_face_encodings, unknown_encoding)
                if True in results:
                    match_index = results.index(True)
                    face_names.append({"name": known_face_names[match_index]})

        result = {
            "face_found_in_image": face_found,
            "face_names": face_names
        }
        return jsonify(result)
    else:
        return jsonify({"error": "Format file tidak diizinkan"}), 400


@app.route('/list_users', methods=['GET'])
def list_users():
    with app.app_context():
        users = User.query.all()
        user_list = []
        for user in users:
            user_info = {
                "id": user.id,
                "name": user.name,
                "encoding_count": len(user.encodings)
            }
            user_list.append(user_info)
    
    return jsonify(user_list)

# Endpoint to test face accuration
# @app.route('/face_accuracy', methods = ['GET'])
# def face_dataAccuration():
#     with app.app_context():
#         users = User.query.all()
#         accuracy_data = []
#         for user in users:
#             user_data = {
#                 "name": user.name,
#                 "encoding": len(user.encodings)
#             }
#             accuracy_data.append(user_data)
            
#     return jsonify(accuracy_data)
    

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001, debug=True)
