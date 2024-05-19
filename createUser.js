const mongoose = require('mongoose');
const User = require('./model/User');

// Connection to MongoDB
mongoose.connect("mongodb://localhost:27017/27017", { useNewUrlParser: true, useUnifiedTopology: true });

const createUser = async () => {
    const newUser = new User({
        username: 'slim', // Remplacez 'nom_utilisateur' par le nom d'utilisateur désiré
        password: 'admin'  // Remplacez 'mot_de_passe' par le mot de passe désiré
    });

    // Enregistrer l'utilisateur dans la base de données
    User.register(newUser, newUser.password, function(err, user) {
        if (err) {
            console.log(err);
            mongoose.disconnect();
            return;
        }
        console.log('Utilisateur créé avec succès:', user);
        mongoose.disconnect();
    });
};

createUser();
