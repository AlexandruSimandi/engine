import { ObjectPattern, ObjectProperty, isObjectProperty } from '@babel/types';
import { OperationTypes, StructOperation } from '../lib/producer/types';
import { processValue } from './processValue';

export const processStruct = (obj: ObjectPattern): StructOperation => {
  const result = obj.properties.reduce(
    (acc, x) => {
      if (isObjectProperty(x)) {
        const node = x as ObjectProperty;
        const propName = node.key.name;
        const propValue = processValue(node);
        if (propValue) {
          acc.value[propName] = propValue;
        }
      } else {
        console.log('Not object property', x);
      }
      return acc;
    },
    {
      type: OperationTypes.STRUCT,
      value: {}
    } as StructOperation
  );
  return result;
};