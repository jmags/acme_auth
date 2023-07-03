const Sequelize = require('sequelize');
const { STRING } = Sequelize;
const config = {
    logging: false
};
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

require('dotenv').config();
const SALT_ROUNDS = 10;

if (process.env.LOGGING) {
    delete config.logging;
}
const conn = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost/acme_db', config);

const User = conn.define('user', {
    username: STRING,
    password: STRING
});

User.beforeCreate(async (user) => {
    user.password = await bcrypt.hash(user.password, SALT_ROUNDS);
});

User.byToken = async (token) => {
    try {
        const payload = jwt.verify(token, process.env.JWT);
        // const user = await User.findByPk(token);
        const user = await User.findByPk(payload.id);
        if (user) {
            return user;
        }
        const error = Error('bad credentials');
        error.status = 401;
        throw error;
    }
    catch (ex) {
        const error = Error('bad credentials');
        error.status = 401;
        throw error;
    }
};

User.authenticate = async ({ username, password }) => {
    const user = await User.findOne({
        where: {
            username
        }
    });
    if (user && await bcrypt.compare(password, user.password)) {
        return jwt.sign({ id: user.id }, process.env.JWT);
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
};


const Note = conn.define('note', {
    text: STRING
});


Note.belongsTo(User);
User.hasMany(Note);


const syncAndSeed = async () => {
    await conn.sync({ force: true });
    const credentials = [
        { username: 'lucy', password: 'lucy_pw' },
        { username: 'moe', password: 'moe_pw' },
        { username: 'larry', password: 'larry_pw' }
    ];
    const [lucy, moe, larry] = await Promise.all(
        credentials.map(credential => User.create(credential))
    );
    const notes = [
        { text: 'Having issued this mandate with as much potentiality' },
        { text: 'I never saw such a beautiful colour on my mother\’s face before.' },
        { text: 'Here was a coincidence!'}
    ];
    const [note1, note2, note3] = await Promise.all(notes.map(note => Note.create(note)));
    await lucy.setNotes(note1);
    await moe.setNotes([note2, note3]);
    return {
        users: {
            lucy,
            moe,
            larry
        }
    };
};

module.exports = {
    syncAndSeed,
    models: {
        User,
        Note
    }
};