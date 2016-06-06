import { sourceNode } from './sourceNode';
import { collectVariables } from './expression/variable';
import { isSingleChild, unique, notNull } from '../utils';
import { compileToExpression } from './attribute';
import { Figure } from '../figure';

export default {
  Element: ({parent, node, figure, compile}) => {
    node.reference = null;

    let templateName = node.name;
    let childName = 'child' + figure.uniqid('child_name');
    let placeholder;

    if (isSingleChild(parent, node)) {
      placeholder = parent.reference;
    } else {
      node.reference = placeholder = 'custom' + figure.uniqid('placeholder');
      figure.declare(sourceNode(`var ${placeholder} = document.createComment('${node.name}');`));
    }

    figure.declare(sourceNode(`var ${childName} = {};`));

    let data = [];
    let variables = [];

    // Collect info about variables and attributes.
    for (let attr of node.attributes) {
      if (attr.type == 'SpreadAttribute') {

        figure.spot(attr.identifier.name).add(
          sourceNode(node.loc,
            `      Monkberry.insert(_this, ${placeholder}, ${childName}, ${templateName}, ${attr.identifier.name}, true)`
          )
        );

      } else {

        let [expr, ] = compileToExpression(attr, compile); // TODO: Add support for default value in custom tag attributes attr={{ value || 'default' }}.
        variables = variables.concat(collectVariables(expr));

        let property = sourceNode(node.loc, [`'${attr.name}': ${compile(expr)}`]);
        data.push(property);

      }
    }

    variables = unique(variables);
    data = `{${data.join(', ')}}`;

    // Add spot for custom attribute or insert on render if no variables in attributes.
    if (variables.length > 0) {

      figure.spot(variables).add(
        sourceNode(node.loc,
          `      Monkberry.insert(_this, ${placeholder}, ${childName}, ${templateName}, ${data}, true)`
        )
      );

    } else {

      figure.addRenderActions(
        sourceNode(node.loc,
          `    Monkberry.insert(_this, ${placeholder}, ${childName}, ${templateName}, ${data}, true);`
        ));

    }

    if (node.body.length > 0) {
      let subfigure = new Figure(templateName, figure);
      subfigure.children = node.body.map((node) => compile(node, subfigure)).filter(notNull);

      figure.addFigure(subfigure);
    }

    return node.reference;
  }
};
