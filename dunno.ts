import { log } from "console";
import { PRIORITY_BELOW_NORMAL } from "constants";
import { readFile, stat } from "fs";

 interface Action<T> {
  name: string;
  ask: (context: T) => boolean;
  do: (context: T) => void;
};

class Context<T extends Cloneable & Costable> implements Cloneable {
  actionHistory: string[] = [];
  constructor(public readonly state: T) {
  };
  clone() {
    const n = new Context<T>(this.state.clone());
    n.actionHistory = [...this.actionHistory];
    return n;
  };
}
interface Cloneable {
  clone();
};

interface Costable {
  cost(): number;
};

class Application<StateType extends Cloneable & Costable> {
  public readonly realContext: Context<StateType>;
  constructor(state: StateType) {
    this.realContext = new Context<StateType>(state);
  };

  actions: Action<StateType>[] = [];

  addActions(newActions: Action<StateType>[]): void {
    this.actions.push(...newActions);
  };

  showPossibles(): string[] {
    const possibles = this.actions.filter((a) => a.ask(this.realContext.state));
    return possibles.map(p => p.name);
  };

  // an imaged context with a set of dids that got to the wanted action
  findImaginedRouteTo(wantedActionName:string ): Context<StateType> | null {
    const imagineStep = (wantedActionName: string, context: Context<StateType>): Context<StateType>[] => {
      //console.log(`imagingStep: ${JSON.stringify(context)}`);
      const sucessfullContexts: Context<StateType>[] = [];
      const possibles = this.actions.filter(a => a.ask(context.state));
      const wantedAction = possibles.find((a: Action<StateType>) => (a.name == wantedActionName));

      if (wantedAction) {
        //console.log("wanted found");
        wantedAction.do(context.state);
        context.actionHistory.push(wantedAction.name);
        return [context];
      } 
      const actionsToTry = possibles.forEach( (a) => {
        //console.log(`imagining doing action ${a.name}`);
        a.do(context.state);
        context.actionHistory.push(a.name);

        const res = imagineStep(wantedActionName, context.clone());
        if (res != null) {
          sucessfullContexts.push(...res);
        }
      });
      
      return sucessfullContexts;
    };
    // needs a clone of the state, but an empty context
    const imaginaryContext = new Context<StateType>(this.realContext.state.clone());

    const routes = imagineStep(wantedActionName, imaginaryContext);
    if( routes.length == 0) {
      return null;
    } 

    routes.sort( (a,b) => (a.state.cost() - b.state.cost()));
    return routes[0];
  }
  run(wantedActionName: string) {
    let nextRoute;
    while (1) {
      //console.log(`before imagining:`);
      //console.log(this.realContext);
      const imagined = this.findImaginedRouteTo(wantedActionName);
      if (!imagined) {
        console.log(`no imagined route returned`);
      }
      //console.log(`imaginged:`);
      //console.log(imagined);
      const nextAction = imagined!.actionHistory[0];

      const action = this.actions.find( a => a.name == nextAction);
      console.log(`Really doing action: ${nextAction}`);
      action!.do(this.realContext.state);
      this.realContext.actionHistory.push(nextAction);
      console.log(this.realContext);
      if( nextAction == wantedActionName) {
        console.log(`desired action complete`);
        break;
      }
    }
  };
}

// ..................

/* 
Questions:

has item been dispatched?

I might be able to:
  dispatch item
  package order
  take payment
  cancel order
*/



class ShopState implements Cloneable, Costable{
  address?: string;
  dispatched: boolean = false;
  paymentKey?: string;
  packaged: boolean = false;
  dids: string[] = [];
  voucherAdded = false;

  clone(): ShopState {
    const c = new ShopState();
    c.address = this.address;
    c.dispatched = this.dispatched;
    c.paymentKey = this.paymentKey;
    c.packaged = this.packaged;
    c.dids = [...this.dids];
    c.voucherAdded = this.voucherAdded;
    return c;
  };
  cost(): number {
    return this.dids.length;
  };
};

const dispatchItem: Action<ShopState>= {
  name: 'dispatchItem',
  ask: (state: ShopState) => {
    return (!!state.address && !state.dispatched && !!state.paymentKey  && !!state.packaged && !!state.voucherAdded);
  },
  do: (state) => {
    state.dids.push(`dispatch to address ${state.address}, payment was ${state.paymentKey}`); 
    state.dispatched = true;
  },
};

const getAddress: Action<ShopState> = {
  name: 'getAddress',
  ask: (state) => !state.address,
  do: (state) => {
    state.address = '1 golden acres, norwich';
    state.dids.push(`got address: ${state.address}`);
  },
};

const getPayment: Action<ShopState> = {
  name: 'getPayment',
  ask: (state) => {
    return !!state.address && !state.paymentKey;
  },
  do: (state) => {
    state.paymentKey = '5435334';
    state.dids.push(`took payment, key=${state.paymentKey}`);
  },
};

const addVoucher: Action<ShopState> = {
  name: 'addVoucher',
  ask: (state) => {
    return !state.voucherAdded;
  },
  do: (state) => {
    state.voucherAdded = true;
    state.dids.push(`Addded voucher`);
  },
};


const packageItem: Action<ShopState> = {
  name: 'packageItem',
  ask: (state) => (!state.packaged),
  do: (state) => {
    state.packaged = true
    state.dids.push(`packaged item`);
  },
};


const shopApp = new Application<ShopState>(new ShopState);

shopApp.addActions([dispatchItem, packageItem, getPayment, getAddress, addVoucher]);

console.log(shopApp.findImaginedRouteTo('dispatchItem'));
shopApp.run('dispatchItem');