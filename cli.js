const BANNER_ONE = `
                  O~~     O~~        
                  O~~     O~~      O~
O~ O~~     O~~    O~~  O~~O~~  O~~   
O~  O~~  O~~  O~~ O~~ O~~ O~~ O~~ O~~
O~   O~~O~~   O~~ O~O~~   O~O~~   O~~
O~~ O~~ O~~   O~~ O~~ O~~ O~~ O~~ O~~
O~~       O~~ O~~~O~~  O~~O~~  O~~O~~
O~~
         your ultimate build toolkit.
`;

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

  async run() {
    const command = process.argv[2];
    const handler = this.commands[command];

    this.printBanner();

    if(!handler) {
      return this.printHelp();
    }

    return await handler(this.context, process.argv.slice(2));
  }
}


module.exports = {
  cli(context) {
    return new CommandBuilder(context);
  }
};
