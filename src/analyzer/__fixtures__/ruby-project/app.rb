require_relative 'lib/helper'
require_relative 'lib/config'

# require_relative 'lib/fake'

def main
  Helper.run
  Config.load
end
