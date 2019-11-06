const pkg = require('./package.json');

const BANNER_ONE = `
                  O~~     O~~        
                  O~~     O~~      O~
O~ O~~     O~~    O~~  O~~O~~  O~~   
O~  O~~  O~~  O~~ O~~ O~~ O~~ O~~ O~~
O~   O~~O~~   O~~ O~O~~   O~O~~   O~~
O~~ O~~ O~~   O~~ O~~ O~~ O~~ O~~ O~~
O~~       O~~ O~~~O~~  O~~O~~  O~~O~~
O~~                           
                               v${pkg.version}

         your ultimate build toolkit.

O~~O~~O~~O~~O~~O~~O~~O~~O~~O~~O~~O~~O
`;

/*
const BANNER_TWO = `
                  /^^     /^^        
                  /^^     /^^      /^
/^ /^^     /^^    /^^  /^^/^^  /^^   
/^  /^^  /^^  /^^ /^^ /^^ /^^ /^^ /^^
/^   /^^/^^   /^^ /^/^^   /^/^^   /^^
/^^ /^^ /^^   /^^ /^^ /^^ /^^ /^^ /^^
/^^       /^^ /^^^/^^  /^^/^^  /^^/^^
/^^                                  
         your ultimate build toolkit.
`;
*/

class CommandBuilder {
  constructor(context) {
    this.context = context;
    this.commands = {};
    this.command('help', () => this.printHelp());
  }

  command(name, callback) {
    this.commands[name] = callback;
    return this;
  }

  printHelp() {
    console.log();
    console.log('(╯°□°)╯︵ ɹoɹɹƎ');
    console.log('---------------');
    console.log('Help me, I don\'t know what I\'m doing!');
    console.log();
    console.log();
    
    console.log('Commands:');
    Object.keys(this.commands).forEach(c => {
      console.log(`  ${c}`);
    });
    console.log();
    console.log();

    console.log('look into build.js for more information ;]');
    process.exit(1);
  }

  printBanner() {
    console.log(BANNER_ONE);
    console.log();
    console.log();
  }

  async run(options = {}) {
    const command = process.argv[2];
    const handler = this.commands[command];
    const args = process.argv.slice(2);

    this.printBanner();
    if(!handler) {
      return this.printHelp();
    }

    this.lastCommand = command;
    let results, lastError;

    try {
      results = await handler(this.context, args);
    } catch(err) {
      console.error('(╯°□°)╯︵ ɹoɹɹƎ!');
      console.error('----------------');
      console.error('While running command:', command);
      console.error();
      console.error(err.stack);
      lastError = err;

      if(!options.noHalt) {
        process.exit(1);
      }
    }

    return {
      success: !!results,
      results,
      command,
      error: lastError
    };
  }
}

module.exports = {
  cli(context) {
    return new CommandBuilder(context);
  }
};
